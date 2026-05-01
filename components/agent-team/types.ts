/**
 * Shared types + constants for the multi-agent pipeline visualization.
 * Consumed by the showcase dashboard (/agent-team-analytics-dashboard)
 * AND by the live consult page (/consult) when "Show pipeline" is on.
 *
 * The PipelineEvent shape is a structural superset of CaptureEvent from
 * lib/agents/orchestrator.ts — same wire format, plus the local
 * { type: "error" } event the SSE route also emits on a thrown
 * captureSession.
 */

import type {
  SessionCaptureResult,
  SubAgentMeta,
} from "@/lib/agents/sub-agents/types";

export type SubAgentName =
  | "voice"
  | "text"
  | "prescription"
  | "billing"
  | "todos";

export type PipelineEvent =
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
      type: "orchestrator_completed";
      ts: number;
      meta: SubAgentMeta;
      summary: SessionCaptureResult["summary"];
    }
  | { type: "session_completed"; ts: number; result: SessionCaptureResult }
  | { type: "error"; message: string };

export interface AgentLane {
  agent: SubAgentName;
  startedAt?: number;
  completedAt?: number;
  meta?: SubAgentMeta;
  failed?: string;
}

export interface OrchestratorRange {
  s?: number;
  e?: number;
}

export type AgentLanes = Record<SubAgentName, AgentLane>;

export interface SubAgentSpec {
  id: SubAgentName;
  label: string;
  tavily: boolean;
  hint: string;
}

export const SUB_AGENTS: SubAgentSpec[] = [
  { id: "voice", label: "Voice", tavily: false, hint: "Owner statements + tone" },
  { id: "text", label: "Text + Vision", tavily: false, hint: "SOAP + differentials" },
  { id: "prescription", label: "Prescription", tavily: true, hint: "Recall + interaction checks" },
  { id: "billing", label: "Billing", tavily: true, hint: "Matrix + revenue leaks" },
  { id: "todos", label: "Staff To-Dos", tavily: false, hint: "Actionable next steps" },
];

export function initialLanes(): AgentLanes {
  return {
    voice: { agent: "voice" },
    text: { agent: "text" },
    prescription: { agent: "prescription" },
    billing: { agent: "billing" },
    todos: { agent: "todos" },
  };
}
