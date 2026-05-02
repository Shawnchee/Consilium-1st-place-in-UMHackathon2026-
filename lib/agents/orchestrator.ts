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
  TokenUsage,
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

/**
 * Partial summary shape emitted as Sonnet streams `emit_session_summary`'s
 * tool input. Fields appear progressively — anything still being generated
 * is undefined or partially populated. The consult page can render whatever
 * is present.
 */
export type PartialSessionSummary = Partial<SessionSummaryOutput>;

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
  onDelta?: (partial: PartialSessionSummary) => void,
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

  // Cache the orchestrator's system + emit-tool spec — both static across
  // every consult. Only the user message (sub-agent JSON) varies.
  //
  // Note: as of 2026-05, the system prompt (~476 tokens) and tool schema
  // (~600 tokens) are each below the 2048-token Sonnet 4.6 cache minimum,
  // so cache_creation_input_tokens will be 0 and there is no read benefit.
  // Markers are kept so caching kicks in automatically if either prefix
  // grows past 2048 tokens later.
  const cachedSystem: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];
  const cachedTools = [
    { ...EMIT_SUMMARY_TOOL, cache_control: { type: "ephemeral" } },
  ] as Anthropic.Tool[];

  // Stream the response so SOAP / Rx fields render as Sonnet generates
  // them. The SDK auto-accumulates `input_json_delta` events into the
  // tool-use block's `.input` object — every `inputJson` callback fires
  // with the up-to-date partial parse, which we forward via onDelta.
  const stream = c.messages.stream({
    model: ORCHESTRATOR_MODEL,
    max_tokens: MAX_TOKENS,
    system: cachedSystem,
    tools: cachedTools,
    tool_choice: {
      type: "tool",
      name: EMIT_SUMMARY_TOOL.name,
    } as Anthropic.ToolChoice,
    messages: [{ role: "user", content: userMessage }],
  });

  if (onDelta) {
    stream.on("inputJson", (_partial, snapshot) => {
      if (snapshot && typeof snapshot === "object") {
        try {
          onDelta(snapshot as PartialSessionSummary);
        } catch {
          // delta sink threw — ignore, the final value still wins
        }
      }
    });
  }

  const response = await stream.finalMessage();
  const usage: TokenUsage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cacheCreationTokens: response.usage?.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
  };
  console.info(
    `[orchestrator] usage: in=${usage.inputTokens} out=${usage.outputTokens} cache_create=${usage.cacheCreationTokens} cache_read=${usage.cacheReadTokens}`,
  );

  type Block = { type: string; [k: string]: unknown };
  const blocks = response.content as unknown as Block[];
  const emit = blocks.find(
    (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use" && b.name === EMIT_SUMMARY_TOOL.name,
  );
  if (emit) {
    const raw = emit.input as unknown as Partial<SessionSummaryOutput>;
    // Sonnet sometimes omits the pass-through slices (billing/todos/prescription)
    // even though the schema marks them required — likely because it sees them
    // already-rendered in the user message and skips the redundant copy. Backfill
    // from the sub-agent aggregate so the UI never renders an empty card just
    // because the orchestrator dropped a field.
    const summary: SessionSummaryOutput = {
      doctorSummary: raw.doctorSummary!,
      ownerMessage: raw.ownerMessage!,
      prescription:
        raw.prescription ?? agg.prescription?.data?.prescription ?? [],
      billing: raw.billing ?? agg.billing?.data?.billing ?? [],
      todos: raw.todos ?? agg.todos?.data?.todos ?? [],
    };
    return {
      summary,
      meta: {
        agent: "orchestrator",
        model: ORCHESTRATOR_MODEL,
        latencyMs: Date.now() - startedAt,
        source: "glm",
        usage,
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
      usage,
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
  orchestratorMeta: SubAgentMeta;
  meta: {
    parallelAgentsLatencyMs: number;
    orchestratorLatencyMs: number;
    source: "mock" | "glm";
  };
}

export type SubAgentName =
  | "voice"
  | "text"
  | "prescription"
  | "billing"
  | "todos";

/**
 * Lifecycle events emitted during captureSession. The dashboard SSE
 * endpoint forwards these to the browser so judges see the parallel
 * fan-out, Tavily lookups, and orchestrator step happen live.
 */
export type CaptureEvent =
  | { type: "session_started"; ts: number; patientName: string }
  | { type: "agent_started"; ts: number; agent: SubAgentName }
  | {
      type: "agent_completed";
      ts: number;
      agent: SubAgentName;
      meta: SubAgentMeta;
      data: unknown;
    }
  | { type: "agent_failed"; ts: number; agent: SubAgentName; error: string }
  | {
      type: "tavily_called";
      ts: number;
      agent: SubAgentName;
      query: string;
      reason: string;
      cached: boolean;
      results: number;
    }
  | { type: "fanout_completed"; ts: number; latencyMs: number }
  | { type: "orchestrator_started"; ts: number }
  | {
      type: "orchestrator_delta";
      ts: number;
      partial: PartialSessionSummary;
    }
  | {
      type: "orchestrator_completed";
      ts: number;
      meta: SubAgentMeta;
      summary: SessionSummaryOutput;
    }
  | { type: "session_completed"; ts: number; result: CaptureSessionResult };

export interface CaptureSessionOptions {
  /**
   * Lifecycle event sink. Errors thrown by the callback are swallowed so
   * a misbehaving listener can't tank the consult.
   */
  onEvent?: (event: CaptureEvent) => void;
}

/**
 * Top-level entry: fans out the five sub-agents in parallel, then runs
 * the orchestrator. Failures in any sub-agent are non-fatal — the
 * aggregate just omits that slice and the orchestrator works with what
 * it has.
 */
export async function captureSession(
  input: SessionInput,
  opts: CaptureSessionOptions = {},
): Promise<CaptureSessionResult> {
  const emit = (e: CaptureEvent) => {
    try {
      opts.onEvent?.(e);
    } catch (err) {
      console.warn("[orchestrator] onEvent threw, ignoring", err);
    }
  };

  emit({
    type: "session_started",
    ts: Date.now(),
    patientName: input.patientName,
  });

  const fanOutStart = Date.now();

  const runOne = async <T>(
    name: SubAgentName,
    fn: () => Promise<{ data: T; meta: SubAgentMeta }>,
  ) => {
    emit({ type: "agent_started", ts: Date.now(), agent: name });
    const out = await fn();
    out.meta.tavilyQueries?.forEach((q) =>
      emit({
        type: "tavily_called",
        ts: Date.now(),
        agent: name,
        query: q.query,
        reason: q.reason,
        cached: q.cached,
        results: q.results,
      }),
    );
    emit({
      type: "agent_completed",
      ts: Date.now(),
      agent: name,
      meta: out.meta,
      data: out.data,
    });
    return out;
  };

  const [voiceR, textR, rxR, billR, todosR] = await Promise.allSettled([
    runOne("voice", () => runVoiceAgent(input)),
    runOne("text", () => runTextAgent(input)),
    runOne("prescription", () => runPrescriptionAgent(input)),
    runOne("billing", () => runBillingAgent(input)),
    runOne("todos", () => runTodosAgent(input)),
  ]);

  const aggregate: SessionAggregate = {};
  const settle = <K extends SubAgentName, V>(
    key: K,
    name: SubAgentName,
    r: PromiseSettledResult<{ data: V; meta: SubAgentMeta }>,
    setter: (data: V, meta: SubAgentMeta) => void,
  ) => {
    if (r.status === "fulfilled") setter(r.value.data, r.value.meta);
    else {
      console.warn(`[orchestrator] ${key} sub-agent failed:`, r.reason);
      emit({
        type: "agent_failed",
        ts: Date.now(),
        agent: name,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  };

  settle("voice", "voice", voiceR, (data, meta) => {
    aggregate.voice = { data, meta };
  });
  settle("text", "text", textR, (data, meta) => {
    aggregate.text = { data, meta };
  });
  settle("prescription", "prescription", rxR, (data, meta) => {
    aggregate.prescription = { data, meta };
  });
  settle("billing", "billing", billR, (data, meta) => {
    aggregate.billing = { data, meta };
  });
  settle("todos", "todos", todosR, (data, meta) => {
    aggregate.todos = { data, meta };
  });

  const fanOutLatencyMs = Date.now() - fanOutStart;
  emit({
    type: "fanout_completed",
    ts: Date.now(),
    latencyMs: fanOutLatencyMs,
  });

  emit({ type: "orchestrator_started", ts: Date.now() });
  // Throttle orchestrator_delta to ~10/sec — partial-JSON snapshots fire
  // once per token from the SDK, which would flood the SSE channel and
  // cause the browser to spend more time parsing than rendering.
  let lastDeltaAt = 0;
  const DELTA_MIN_INTERVAL_MS = 100;
  const { summary, meta: orchMeta } = await runOrchestrator(
    input,
    aggregate,
    (partial) => {
      const now = Date.now();
      if (now - lastDeltaAt < DELTA_MIN_INTERVAL_MS) return;
      lastDeltaAt = now;
      emit({ type: "orchestrator_delta", ts: now, partial });
    },
  );
  emit({
    type: "orchestrator_completed",
    ts: Date.now(),
    meta: orchMeta,
    summary,
  });

  // Single source rollup: if everything was mock, label the whole thing mock.
  const allMock =
    orchMeta.source === "mock" &&
    Object.values(aggregate).every((slice) => slice?.meta.source === "mock");
  const source: "mock" | "glm" = allMock ? "mock" : "glm";

  const result: CaptureSessionResult = {
    session: aggregate,
    summary,
    orchestratorMeta: orchMeta,
    meta: {
      parallelAgentsLatencyMs: fanOutLatencyMs,
      orchestratorLatencyMs: orchMeta.latencyMs,
      source,
    },
  };
  emit({ type: "session_completed", ts: Date.now(), result });
  return result;
}
