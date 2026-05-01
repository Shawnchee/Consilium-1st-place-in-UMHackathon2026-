/**
 * Consultation capture orchestrator.
 *
 * Runs the five Haiku sub-agents (voice, text, prescription, billing,
 * todos) in parallel via Promise.allSettled, then calls Sonnet 4.6 to
 * synthesize a single dual-audience summary:
 *   1. doctorSummary — SOAP card + key findings + flags + next steps,
 *      shown on the dashboard the moment the consult ends.
 *   2. ownerMessage  — friendly Telegram body + aftercare bullets,
 *      delivered to the owner's chat when telegramChatId is configured.
 *
 * The orchestrator is intentionally a pure function over the sub-agent
 * aggregate: no DB writes, no Telegram sends. Persistence + delivery is
 * the route's job (app/api/consult/capture/route.ts).
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENV, hasLLM, isMockMode } from "../env";
import { runBillingAgent } from "./sub-agents/billing-agent";
import { runPrescriptionAgent } from "./sub-agents/prescription-agent";
import { runTextAgent } from "./sub-agents/text-agent";
import { runTodosAgent } from "./sub-agents/todos-agent";
import { runVoiceAgent } from "./sub-agents/voice-agent";
import type {
  SessionAggregate,
  SessionInput,
  SessionSummaryOutput,
  SubAgentMeta,
} from "./sub-agents/types";

const ORCHESTRATOR_MODEL = ENV.anthropic.modelConsult; // Sonnet 4.6
const MAX_TOKENS = 2400;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ENV.anthropic.apiKey });
  return client;
}

const EMIT_SUMMARY_TOOL = {
  name: "emit_session_summary",
  description:
    "Emit the dual-audience consultation summary. Call exactly once when ready.",
  input_schema: {
    type: "object" as const,
    properties: {
      doctorSummary: {
        type: "object",
        properties: {
          soap: {
            type: "object",
            properties: {
              S: { type: "string" },
              O: { type: "string" },
              A: { type: "string" },
              P: { type: "string" },
            },
            required: ["S", "O", "A", "P"],
          },
          keyFindings: {
            type: "array",
            description: "Top 3-5 findings the doctor wants to see at a glance.",
            items: { type: "string" },
          },
          flags: {
            type: "array",
            description:
              "Anything that needs doctor attention: revenue leak, drug-recall warning, missing vitals, etc.",
            items: { type: "string" },
          },
          nextSteps: {
            type: "array",
            description: "Prioritised next-step actions for the clinic.",
            items: { type: "string" },
          },
        },
        required: ["soap", "keyFindings", "flags", "nextSteps"],
      },
      ownerMessage: {
        type: "object",
        properties: {
          body: {
            type: "string",
            description:
              "Telegram-friendly message body (≤ 600 chars). Plain text. No markdown asterisks. Sign off with the clinic name placeholder {clinic}.",
          },
          aftercare: {
            type: "array",
            description: "Plain-language aftercare bullets the owner can follow.",
            items: { type: "string" },
          },
        },
        required: ["body", "aftercare"],
      },
      prescription: {
        type: "array",
        items: {
          type: "object",
          properties: {
            drug: { type: "string" },
            dose: { type: "string" },
            dur: { type: "string" },
            qty: { type: "string" },
          },
          required: ["drug", "dose", "dur", "qty"],
        },
      },
      billing: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            price: { type: "number" },
            flagged: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["item", "price", "flagged", "note"],
        },
      },
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string" },
            who: { type: "string" },
          },
          required: ["task", "who"],
        },
      },
    },
    required: [
      "doctorSummary",
      "ownerMessage",
      "prescription",
      "billing",
      "todos",
    ],
  },
};

const SYSTEM_PROMPT = `You are the ORCHESTRATOR agent in a multi-agent veterinary consultation pipeline. Five Haiku sub-agents have already fanned out in parallel and produced the structured slices below:

  • voice — owner statements + reported symptoms + history + tone
  • text — chief complaint + observations + vitals + differentials
  • prescription — Rx items + safety warnings (Tavily-checked)
  • billing — line items + revenue-leak flags (Tavily-checked)
  • todos — staff action items

Your job: call emit_session_summary EXACTLY ONCE producing two audiences.

  1. doctorSummary
     - soap: SOAP note (S/O/A/P). Build S from the voice agent's owner statements + reported symptoms. Build O from the text agent's observations + vitals. Build A from the text agent's diagnosisCandidates (most likely first). Build P from the prescription + todos.
     - keyFindings: top 3-5 most important things the doctor wants to see at a glance.
     - flags: surface every revenue-leak (billing.flagged=true), every prescription warning, and any vitals the doctor forgot to record.
     - nextSteps: prioritised. Doctor first, then staff.

  2. ownerMessage
     - body: friendly Telegram message addressed to the OWNER (you are writing AS the clinic, not the doctor). Use the voice agent's emotionalTone to set the register: if "worried" → reassuring; if "calm" → matter-of-fact; if "frustrated" → empathetic. Plain text only — no markdown, no asterisks. Sign off with "— {clinic}". Keep it under 600 characters. NEVER include billing prices or staff todos in this message.
     - aftercare: 3-5 plain-language bullets the owner can act on.

  3. prescription / billing / todos: pass through the sub-agent outputs verbatim. The orchestrator's job is composition, not editing.

If a sub-agent's slice is empty (e.g. the voice agent received no transcript), do not invent content — just compose the summary from what's available.`.trim();

interface RunOrchestratorResult {
  summary: SessionSummaryOutput;
  meta: SubAgentMeta;
}

function fallbackSummary(
  input: SessionInput,
  agg: SessionAggregate,
): SessionSummaryOutput {
  const text = agg.text?.data;
  const voice = agg.voice?.data;
  const prescription = agg.prescription?.data?.prescription ?? [];
  const billing = agg.billing?.data?.billing ?? [];
  const todos = agg.todos?.data?.todos ?? [];

  const S = [voice?.ownerStatements ?? [], voice?.reportedSymptoms ?? []]
    .flat()
    .join(". ") || input.notes.slice(0, 200);
  const O =
    text?.observations?.join(". ") ||
    "Exam findings recorded in chart.";
  const A =
    text?.diagnosisCandidates?.join(", ") ||
    input.diagnosisHint ||
    "Pending review.";
  const P =
    prescription.length > 0
      ? prescription
          .map((p) => `${p.drug} ${p.dose} ${p.dur}`)
          .join("; ")
      : "Continue current care, recheck if not improving.";

  return {
    doctorSummary: {
      soap: { S, O, A, P },
      keyFindings:
        text?.observations?.slice(0, 4) ?? [],
      flags: [
        ...(agg.billing?.data.billing.filter((b) => b.flagged).map((b) => `Billing: ${b.item} — ${b.note}`) ?? []),
        ...(agg.prescription?.data.warnings ?? []),
      ],
      nextSteps: todos.map((t) => `[${t.who}] ${t.task}`),
    },
    ownerMessage: {
      body: `Hi! ${input.patientName} was seen today. ${A === "Pending review." ? "We've recorded our findings and will follow up if needed." : `Working diagnosis: ${A}.`} ${prescription.length > 0 ? `Please follow the prescribed medication as labelled. ` : ""}Reach out anytime with questions. — {clinic}`,
      aftercare: prescription.map((p) => `${p.drug}: ${p.dose} for ${p.dur}.`),
    },
    prescription,
    billing,
    todos,
  };
}

async function runOrchestrator(
  input: SessionInput,
  agg: SessionAggregate,
): Promise<RunOrchestratorResult> {
  const startedAt = Date.now();

  if (isMockMode() || !hasLLM()) {
    return {
      summary: fallbackSummary(input, agg),
      meta: {
        agent: "orchestrator",
        model: "fixture",
        latencyMs: Date.now() - startedAt,
        source: "mock",
      },
    };
  }

  const c = getClient();
  const userMessage = buildOrchestratorUserMessage(input, agg);

  const response = (await c.messages.create({
    model: ORCHESTRATOR_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [EMIT_SUMMARY_TOOL] as Anthropic.Tool[],
    tool_choice: {
      type: "tool",
      name: EMIT_SUMMARY_TOOL.name,
    } as Anthropic.ToolChoice,
    messages: [{ role: "user", content: userMessage }],
  })) as Anthropic.Message;

  type Block = { type: string; [k: string]: unknown };
  const blocks = response.content as unknown as Block[];
  const emit = blocks.find(
    (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use" && b.name === EMIT_SUMMARY_TOOL.name,
  );
  if (emit) {
    return {
      summary: emit.input as unknown as SessionSummaryOutput,
      meta: {
        agent: "orchestrator",
        model: ORCHESTRATOR_MODEL,
        latencyMs: Date.now() - startedAt,
        source: "glm",
      },
    };
  }

  return {
    summary: fallbackSummary(input, agg),
    meta: {
      agent: "orchestrator",
      model: ORCHESTRATOR_MODEL,
      latencyMs: Date.now() - startedAt,
      source: "glm",
    },
  };
}

function buildOrchestratorUserMessage(
  input: SessionInput,
  agg: SessionAggregate,
): string {
  const lines: string[] = [
    `Patient: ${input.patientName} (${input.patientSpecies ?? "unknown"}, ${input.patientBreed ?? "unknown"})`,
    "",
    "─── voice agent ───",
    JSON.stringify(agg.voice?.data ?? null, null, 2),
    "",
    "─── text agent ───",
    JSON.stringify(agg.text?.data ?? null, null, 2),
    "",
    "─── prescription agent ───",
    JSON.stringify(agg.prescription?.data ?? null, null, 2),
    "",
    "─── billing agent ───",
    JSON.stringify(agg.billing?.data ?? null, null, 2),
    "",
    "─── todos agent ───",
    JSON.stringify(agg.todos?.data ?? null, null, 2),
    "",
    "Now call emit_session_summary.",
  ];
  return lines.join("\n");
}

export interface CaptureSessionResult {
  session: SessionAggregate;
  summary: SessionSummaryOutput;
  meta: {
    parallelAgentsLatencyMs: number;
    orchestratorLatencyMs: number;
    source: "mock" | "glm";
  };
}

/**
 * Top-level entry: fans out the five sub-agents in parallel, then runs
 * the orchestrator. Failures in any sub-agent are non-fatal — the
 * aggregate just omits that slice and the orchestrator works with what
 * it has.
 */
export async function captureSession(
  input: SessionInput,
): Promise<CaptureSessionResult> {
  const fanOutStart = Date.now();

  const [voiceR, textR, rxR, billR, todosR] = await Promise.allSettled([
    runVoiceAgent(input),
    runTextAgent(input),
    runPrescriptionAgent(input),
    runBillingAgent(input),
    runTodosAgent(input),
  ]);

  const aggregate: SessionAggregate = {};
  if (voiceR.status === "fulfilled") aggregate.voice = { data: voiceR.value.data, meta: voiceR.value.meta };
  else console.warn("[orchestrator] voice sub-agent failed:", voiceR.reason);
  if (textR.status === "fulfilled") aggregate.text = { data: textR.value.data, meta: textR.value.meta };
  else console.warn("[orchestrator] text sub-agent failed:", textR.reason);
  if (rxR.status === "fulfilled") aggregate.prescription = { data: rxR.value.data, meta: rxR.value.meta };
  else console.warn("[orchestrator] prescription sub-agent failed:", rxR.reason);
  if (billR.status === "fulfilled") aggregate.billing = { data: billR.value.data, meta: billR.value.meta };
  else console.warn("[orchestrator] billing sub-agent failed:", billR.reason);
  if (todosR.status === "fulfilled") aggregate.todos = { data: todosR.value.data, meta: todosR.value.meta };
  else console.warn("[orchestrator] todos sub-agent failed:", todosR.reason);

  const fanOutLatencyMs = Date.now() - fanOutStart;

  const { summary, meta: orchMeta } = await runOrchestrator(input, aggregate);

  // Single source rollup: if everything was mock, label the whole thing mock.
  const allMock =
    orchMeta.source === "mock" &&
    Object.values(aggregate).every((slice) => slice?.meta.source === "mock");
  const source: "mock" | "glm" = allMock ? "mock" : "glm";

  return {
    session: aggregate,
    summary,
    meta: {
      parallelAgentsLatencyMs: fanOutLatencyMs,
      orchestratorLatencyMs: orchMeta.latencyMs,
      source,
    },
  };
}
