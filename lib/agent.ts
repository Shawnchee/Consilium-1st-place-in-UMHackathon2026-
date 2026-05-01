/**
 * LangGraph triage sidecar client.
 *
 * The Python FastAPI sidecar (agent/server.py) wraps the triage graph.
 * Response shape mirrors `TriageFixtureOutput` from glm-fixtures.ts so
 * callers (lib/telegram-handler.ts) can treat sidecar and mock output
 * interchangeably.
 *
 * Caller is responsible for falling back if this throws — the sidecar
 * may be down or unreachable, in which case we want the demo to keep
 * working off the mock fixture rather than dying.
 */

import { ENV } from "./env";
import type { TriageFixtureOutput } from "./glm-fixtures";
import type { ConversationTurn } from "./types";

export interface TriageAgentRequest {
  followupId: string;
  patientId: string;
  clinicId: string;
  /** Display name forwarded into the sidecar's TRIAGE_SYSTEM_TEMPLATE sign-off. */
  clinicName?: string;
  chatId: string;
  text: string;
  patientName?: string;
  toolCallCount?: number;
  priorConversation?: ConversationTurn[];
}

/** 
 * Utility to flatten complex ConversationTurns into a role/text pair 
 * suitable for logging or mock LLM prompts. 
 */
export function flattenTurn(t: ConversationTurn): { role: ConversationTurn["role"]; text: string } {
  if (t.role === "owner") return { role: "owner", text: t.text };
  if (t.role === "bot_tool")
    return { role: "bot_tool", text: `[${t.tool}] ${t.ownerPrompt}` };
  return { role: "bot_decision", text: `[${t.decision}] ${t.reply}` };
}

export function isAgentEnabled(): boolean {
  return Boolean(ENV.langgraph.serviceUrl);
}

export async function callTriageAgent(
  req: TriageAgentRequest,
): Promise<TriageFixtureOutput> {
  const baseUrl = ENV.langgraph.serviceUrl;
  if (!baseUrl) throw new Error("LANGGRAPH_SERVICE_URL not set");

  const body = {
    followup_id: req.followupId,
    patient_id: req.patientId,
    clinic_id: req.clinicId,
    clinic_name: req.clinicName ?? "the clinic",
    chat_id: req.chatId,
    text: req.text,
    patient_name: req.patientName ?? "your pet",
    tool_call_count: req.toolCallCount ?? 0,
  };

  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/triage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`triage sidecar ${resp.status}: ${detail.slice(0, 200)}`);
  }

  // Sidecar's TriageOutput uses camelCase fields matching TriageFixtureOutput
  // exactly, so we cast directly. Pydantic on the server side enforces the
  // shape; we trust it here.
  return (await resp.json()) as TriageFixtureOutput;
}
