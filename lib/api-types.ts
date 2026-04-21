/**
 * API contracts shared between client (lib/api.ts) and server (app/api/*).
 * Hand-rolled validators to avoid a zod dep for now — if schemas grow past
 * ~20 fields across all routes, swap this for zod.
 */
import type {
  Patient,
  FollowUp,
  ConsultOutput,
  Brief,
  FollowUpLevel,
  MetricCardData,
  DiagnosisRow,
  CorrectionRow,
  Differential,
} from "./types";

// ─── /api/patients ──────────────────────────────────────────────────────────
export type GetPatientsResponse = { patients: Patient[] };
export type GetPatientResponse = { patient: Patient };

// ─── /api/brief ─────────────────────────────────────────────────────────────
export type GetBriefResponse = {
  patientId: string;
  brief: Brief;
  source: "mock" | "glm";
};

// ─── /api/consult ───────────────────────────────────────────────────────────
export interface ConsultRequest {
  patientId: string;
  notes: string;
}
export type ConsultResponse = {
  visitId: string;
  output: ConsultOutput;
  source: "mock" | "glm";
};
export function parseConsultRequest(raw: unknown): ConsultRequest {
  const r = raw as Partial<ConsultRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.patientId !== "string" || !r.patientId)
    throw new ApiError(400, "patientId required");
  if (typeof r.notes !== "string" || !r.notes.trim())
    throw new ApiError(400, "notes required");
  return { patientId: r.patientId, notes: r.notes };
}

// ─── /api/triage ────────────────────────────────────────────────────────────
export interface TriageRequest {
  followupId: string;
  message: string;
  chatId?: string | number;
}
export interface TriageResponse {
  decision: FollowUpLevel; // "escalate" | "monitor" | "clear"
  confidence: number; // 0..1
  differentials: Differential[];
  recommendedAction: string;
  ownerReplyDraft: string;
  doctorSummary: string;
  source: "mock" | "glm";
}
export function parseTriageRequest(raw: unknown): TriageRequest {
  const r = raw as Partial<TriageRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.followupId !== "string" || !r.followupId)
    throw new ApiError(400, "followupId required");
  if (typeof r.message !== "string" || !r.message.trim())
    throw new ApiError(400, "message required");
  return { followupId: r.followupId, message: r.message, chatId: r.chatId };
}

// ─── /api/followups ─────────────────────────────────────────────────────────
export type GetFollowupsResponse = {
  followups: FollowUp[];
  resolvedCount: number;
};

// ─── /api/metrics ───────────────────────────────────────────────────────────
export type GetMetricsResponse = { metrics: MetricCardData[] };

// ─── /api/analytics ─────────────────────────────────────────────────────────
export type GetAnalyticsResponse = {
  diagnoses: DiagnosisRow[];
  corrections: CorrectionRow[];
};

// ─── /api/corrections ───────────────────────────────────────────────────────
export interface CorrectionRequest {
  feature: "triage" | "billing" | "prescription" | "brief";
  visitId?: string;
  followupId?: string;
  glmOutput: string;
  rejectionReason?: string;
  doctorCorrection?: string;
  approved: boolean;
}
export type CorrectionResponse = { ok: true; id: string };
export function parseCorrectionRequest(raw: unknown): CorrectionRequest {
  const r = raw as Partial<CorrectionRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  const features = ["triage", "billing", "prescription", "brief"] as const;
  if (!features.includes(r.feature as (typeof features)[number]))
    throw new ApiError(400, "feature must be one of: " + features.join(", "));
  if (typeof r.glmOutput !== "string")
    throw new ApiError(400, "glmOutput required");
  if (typeof r.approved !== "boolean")
    throw new ApiError(400, "approved must be boolean");
  return {
    feature: r.feature as CorrectionRequest["feature"],
    visitId: r.visitId,
    followupId: r.followupId,
    glmOutput: r.glmOutput,
    rejectionReason: r.rejectionReason,
    doctorCorrection: r.doctorCorrection,
    approved: r.approved,
  };
}

// ─── errors ─────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
