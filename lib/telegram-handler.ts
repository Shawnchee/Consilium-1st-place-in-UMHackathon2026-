/**
 * Owner-message handler — multi-turn triage with tool calling.
 *
 * Flow:
 *   1. Resolve a followup row via `telegram_chat_id`.
 *   2. Append the owner turn to `conversation`.
 *   3. Run triage. If fixture returns `tool_call` (and we haven't already
 *      spent our one allowed info-gathering turn), append bot_tool turn,
 *      increment tool_call_count, return the tool prompt. Status stays
 *      `pending` — no escalation yet.
 *   4. If fixture returns `decision`, append bot_decision turn, update the
 *      row's status + triage fields, return the reply draft.
 *
 * Every path emits a boxed console log so the terminal shows the agent's
 * reasoning to the judges in real time.
 */

import { callGLM } from "./glm";
import { callTriageAgent, isAgentEnabled } from "./agent";
import { hasSupabaseAdmin } from "./env";
import { getSupabaseServer } from "./supabase";
import type {
  TriageDecision,
  TriageFixtureOutput,
  TriageToolCall,
} from "./glm-fixtures";
import type { ConversationTurn, FollowUpLevel } from "./types";

// Single-clinic demo — the agent's PostgresStore namespace is
// ("consultations", clinic_id, patient_id), so this string just needs
// to be stable across writes and reads.
const DEMO_CLINIC_ID = "pawsclinic_kl";

export interface HandleOwnerMessageResult {
  reply: string;
  decision: FollowUpLevel | "unlinked" | "awaiting_info";
  followupId?: string;
  confidence?: number;
  toolName?: string;
}

type FollowupRowMini = {
  id: string;
  conversation: unknown;
  tool_call_count: number | null;
  visits: { patient_id: string; patients: { name: string | null } | null } | null;
};

const UNLINKED_REPLY = (chatId: string) =>
  `Hi — your chat (id ${chatId}) isn't linked to an active case yet. Share this id with PawsClinic KL reception and we'll pair it to your pet's follow-up. — PawsClinic KL`;

function nowIso(): string {
  return new Date().toISOString();
}

function parseConversation(raw: unknown): ConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw as ConversationTurn[];
}

function conversationText(turns: ConversationTurn[]): string {
  return turns
    .map((t) => {
      if (t.role === "owner") return `owner: ${t.text}`;
      if (t.role === "bot_tool") return `bot_tool(${t.tool}): ${t.ownerPrompt}`;
      return `bot_decision(${t.decision}): ${t.reply}`;
    })
    .join(" | ");
}

/* ─── pretty console logger ───────────────────────────────────────────── */

const BAR = "━".repeat(64);

function logInbound(chatId: string, msg: string, turnIndex: number) {
  console.log();
  console.log(`\x1b[90m${BAR}\x1b[0m`);
  console.log(
    `\x1b[36m[bot]\x1b[0m inbound   chat=${chatId}  turn=${turnIndex}  msg="${msg}"`,
  );
}

function logToolCall(tc: TriageToolCall) {
  console.log(`\x1b[35m[agent]\x1b[0m \x1b[1mcalling tool\x1b[0m → ${tc.tool}`);
  console.log(`  \x1b[90m↳ reasoning:\x1b[0m ${tc.reasoning}`);
  console.log(
    `  \x1b[90m↳ args:\x1b[0m ${JSON.stringify(tc.args)}`,
  );
  console.log(`\x1b[36m[bot]\x1b[0m outbound  "${tc.ownerPrompt}"`);
}

function logDecision(d: TriageDecision) {
  const color =
    d.decision === "escalate"
      ? "\x1b[31m"
      : d.decision === "monitor"
        ? "\x1b[33m"
        : "\x1b[32m";
  console.log(
    `\x1b[35m[agent]\x1b[0m \x1b[1mdecision\x1b[0m → ${color}${d.decision.toUpperCase()}\x1b[0m  confidence=${d.confidence.toFixed(2)}`,
  );
  console.log(`  \x1b[90m↳ reasoning:\x1b[0m ${d.reasoning}`);
  for (const diff of d.differentials) {
    const tone = diff.tone === "red" ? "\x1b[31m" : "\x1b[32m";
    console.log(
      `    ${tone}•\x1b[0m ${diff.cause.padEnd(46)} ${Math.round(diff.prob * 100)}%`,
    );
  }
  console.log(`  \x1b[90m↳ action:\x1b[0m ${d.recommendedAction}`);
  console.log(`\x1b[36m[bot]\x1b[0m outbound  "${d.ownerReplyDraft}"`);
}

function logUnlinked(chatId: string) {
  console.log(
    `\x1b[33m[agent]\x1b[0m no followup linked to chat ${chatId} — sending pairing help`,
  );
}

/* ─── main entry ──────────────────────────────────────────────────────── */

export async function handleOwnerMessage(
  chatId: string,
  text: string,
): Promise<HandleOwnerMessageResult> {
  let row: FollowupRowMini | null = null;

  if (hasSupabaseAdmin()) {
    try {
      const db = getSupabaseServer();
      const { data } = await db
        .from("followups")
        .select(
          "id, conversation, tool_call_count, visits!inner(patient_id, patients!inner(name))",
        )
        .eq("telegram_chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<FollowupRowMini>();
      row = data;
    } catch (err) {
      console.warn("[telegram-handler] followup lookup failed", err);
    }
  }

  if (!row) {
    logInbound(chatId, text, 0);
    logUnlinked(chatId);
    return { reply: UNLINKED_REPLY(chatId), decision: "unlinked" };
  }

  const conv = parseConversation(row.conversation);
  const toolCallCount = row.tool_call_count ?? 0;
  const turnIndex = conv.length + 1;
  const patientId = row.visits?.patient_id ?? null;
  const patientName = row.visits?.patients?.name ?? "your pet";
  logInbound(chatId, text, turnIndex);

  const ownerTurn: ConversationTurn = {
    role: "owner",
    text,
    ts: nowIso(),
  };

  const result = await runTriage({
    text,
    chatId,
    followupId: row.id,
    patientId,
    patientName,
    toolCallCount,
    priorConversation: conv,
  });

  /* ─── tool-call branch ────────────────────────────────────────────── */
  if (result.kind === "tool_call") {
    logToolCall(result);

    const toolTurn: ConversationTurn = {
      role: "bot_tool",
      tool: result.tool,
      args: result.args,
      reasoning: result.reasoning,
      ownerPrompt: result.ownerPrompt,
      ts: nowIso(),
    };

    if (hasSupabaseAdmin()) {
      try {
        const db = getSupabaseServer();
        await db
          .from("followups")
          .update({
            conversation: [...conv, ownerTurn, toolTurn],
            tool_call_count: toolCallCount + 1,
            owner_message: text,
          })
          .eq("id", row.id);
      } catch (err) {
        console.warn("[telegram-handler] tool-call update failed", err);
      }
    }

    return {
      reply: result.ownerPrompt,
      decision: "awaiting_info",
      followupId: row.id,
      toolName: result.tool,
    };
  }

  /* ─── terminal decision branch ────────────────────────────────────── */
  logDecision(result);

  const decisionTurn: ConversationTurn = {
    role: "bot_decision",
    decision: result.decision,
    confidence: result.confidence,
    differentials: result.differentials,
    reply: result.ownerReplyDraft,
    ts: nowIso(),
  };

  if (hasSupabaseAdmin()) {
    try {
      const db = getSupabaseServer();
      await db
        .from("followups")
        .update({
          status: result.decision,
          owner_message: text,
          glm_decision: result.decision,
          confidence: result.confidence,
          differentials: result.differentials,
          recommended_action: result.recommendedAction,
          draft_response: result.ownerReplyDraft,
          conversation: [...conv, ownerTurn, decisionTurn],
        })
        .eq("id", row.id);
    } catch (err) {
      console.warn("[telegram-handler] decision update failed", err);
    }
  }

  return {
    reply: result.ownerReplyDraft,
    decision: result.decision,
    followupId: row.id,
    confidence: result.confidence,
  };
}

/* ─── triage dispatcher ───────────────────────────────────────────────── */

interface RunTriageParams {
  text: string;
  chatId: string;
  followupId: string;
  patientId: string | null;
  patientName: string;
  toolCallCount: number;
  priorConversation: ConversationTurn[];
}

/**
 * Pick the LangGraph sidecar when LANGGRAPH_SERVICE_URL is set; fall back
 * to the in-process callGLM path on any sidecar error so the demo keeps
 * working even if the Python service is down.
 */
async function runTriage(p: RunTriageParams): Promise<TriageFixtureOutput> {
  if (isAgentEnabled() && p.patientId) {
    try {
      return await callTriageAgent({
        followupId: p.followupId,
        patientId: p.patientId,
        clinicId: DEMO_CLINIC_ID,
        chatId: p.chatId,
        text: p.text,
        patientName: p.patientName,
        toolCallCount: p.toolCallCount,
        priorConversation: p.priorConversation,
      });
    } catch (err) {
      console.warn(
        "[telegram-handler] sidecar failed, falling back to mock GLM:",
        err,
      );
    }
  }

  const glmResult = await callGLM<TriageFixtureOutput>({
    feature: "triage",
    user: p.text,
    context: {
      toolCallCount: p.toolCallCount,
      conversationText: conversationText(p.priorConversation),
      patientName: p.patientName,
    },
  });
  return glmResult.data;
}
