/**
 * Multi-agent consultation capture — shared types.
 *
 * Architecture:
 *   - Sub-agents (Haiku 4.5) fan out in parallel, each owning one slice of
 *     the consult: voice, text, prescription, billing, staff to-dos. Each
 *     emits a typed payload via its own emit_<slice> tool. Tavily is opt-in
 *     per sub-agent (currently: prescription, billing).
 *   - The orchestrator (Sonnet 4.6) takes the aggregated outputs and emits
 *     a single dual-audience summary: a doctor SOAP card and an
 *     owner-friendly Telegram message.
 *
 * The shapes here are the contract between the route, the sub-agents, and
 * the orchestrator. Domain types (BillingItem, PrescriptionItem, TodoItem)
 * are reused from lib/types so persistence into the existing visits table
 * stays a no-op shape match.
 */

import type { BillingItem, PrescriptionItem, TodoItem } from "../../types";

export interface SessionInput {
  patientId: string;
  patientName: string;
  patientSpecies?: string;
  patientBreed?: string;
  /** Free-text doctor notes typed in the consult UI. */
  notes: string;
  /** Voice-to-text transcript (Deepgram output) of the consult dictation. */
  transcript?: string;
  /** Public photo URLs (Supabase Storage / Telegram CDN) for vision. */
  imageUrls?: string[];
  /** Optional pre-existing diagnosis hint from the doctor. */
  diagnosisHint?: string;
}

export interface SubAgentMeta {
  agent: string;
  model: string;
  latencyMs: number;
  source: "mock" | "glm";
  toolCalls?: number;
  tavilyUsed?: boolean;
}

export interface VoiceCaptureOutput {
  /** Direct quotes / paraphrased statements from owner reported in dictation. */
  ownerStatements: string[];
  reportedSymptoms: string[];
  relevantHistory: string[];
  /** "worried", "calm", "frustrated" — informs Telegram reply tone. */
  emotionalTone?: string;
}

export interface TextCaptureOutput {
  chiefComplaint: string;
  /** Doctor's clinical observations from typed notes. */
  observations: string[];
  vitals: { name: string; value: string }[];
  /** Working differentials, most likely first. */
  diagnosisCandidates: string[];
}

export interface PrescriptionCaptureOutput {
  prescription: PrescriptionItem[];
  /** Drug-recall, interaction, or species-contraindication flags. */
  warnings: string[];
  /** Brief audit trail if Tavily was consulted. */
  tavilyNotes?: string;
}

export interface BillingCaptureOutput {
  billing: BillingItem[];
  /** Items mentioned in notes but absent from the matrix (price=0, flagged). */
  unmatched: string[];
  tavilyNotes?: string;
}

export interface TodosCaptureOutput {
  todos: TodoItem[];
}

export interface SessionAggregate {
  voice?: { data: VoiceCaptureOutput; meta: SubAgentMeta };
  text?: { data: TextCaptureOutput; meta: SubAgentMeta };
  prescription?: { data: PrescriptionCaptureOutput; meta: SubAgentMeta };
  billing?: { data: BillingCaptureOutput; meta: SubAgentMeta };
  todos?: { data: TodosCaptureOutput; meta: SubAgentMeta };
}

export interface DoctorSummary {
  soap: { S: string; O: string; A: string; P: string };
  keyFindings: string[];
  flags: string[];
  nextSteps: string[];
}

export interface OwnerMessage {
  /** Friendly Telegram body the patient owner receives. */
  body: string;
  aftercare: string[];
}

export interface SessionSummaryOutput {
  doctorSummary: DoctorSummary;
  ownerMessage: OwnerMessage;
  prescription: PrescriptionItem[];
  billing: BillingItem[];
  todos: TodoItem[];
}

export interface SessionCaptureResult {
  visitId: string;
  session: SessionAggregate;
  summary: SessionSummaryOutput;
  meta: {
    totalLatencyMs: number;
    parallelAgentsLatencyMs: number;
    orchestratorLatencyMs: number;
    source: "mock" | "glm";
  };
  telegram?: { sent: boolean; messageId?: number; error?: string };
}
