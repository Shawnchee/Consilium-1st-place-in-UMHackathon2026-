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
  /** Optional public URLs (e.g. Supabase Storage) of photos taken during the consult. */
  imageUrls?: string[];
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
  let imageUrls: string[] | undefined;
  if (r.imageUrls !== undefined) {
    if (!Array.isArray(r.imageUrls) || r.imageUrls.some((u) => typeof u !== "string"))
      throw new ApiError(400, "imageUrls must be string[]");
    imageUrls = r.imageUrls as string[];
  }
  return { patientId: r.patientId, notes: r.notes, imageUrls };
}

// ─── /api/consult/capture ───────────────────────────────────────────────────
export interface ConsultCaptureRequest {
  patientId: string;
  notes: string;
  /** Voice transcript from /api/transcribe (Deepgram). Optional. */
  transcript?: string;
  /** Public photo URLs (Supabase Storage / Telegram CDN). Optional. */
  imageUrls?: string[];
  /** Optional pre-existing diagnosis hint. */
  diagnosisHint?: string;
  /**
   * Opt-in Telegram delivery. Default is FALSE — the route only generates
   * the draft. Doctor reviews and fires /api/consult/telegram-send to
   * deliver. Set true only for backfill / scripted flows where the
   * draft does not need doctor review.
   */
  sendTelegram?: boolean;
}
export function parseConsultCaptureRequest(raw: unknown): ConsultCaptureRequest {
  const r = raw as Partial<ConsultCaptureRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.patientId !== "string" || !r.patientId)
    throw new ApiError(400, "patientId required");
  if (typeof r.notes !== "string" || !r.notes.trim())
    throw new ApiError(400, "notes required");
  if (r.transcript !== undefined && typeof r.transcript !== "string")
    throw new ApiError(400, "transcript must be string");
  if (r.diagnosisHint !== undefined && typeof r.diagnosisHint !== "string")
    throw new ApiError(400, "diagnosisHint must be string");
  if (r.sendTelegram !== undefined && typeof r.sendTelegram !== "boolean")
    throw new ApiError(400, "sendTelegram must be boolean");
  let imageUrls: string[] | undefined;
  if (r.imageUrls !== undefined) {
    if (!Array.isArray(r.imageUrls) || r.imageUrls.some((u) => typeof u !== "string"))
      throw new ApiError(400, "imageUrls must be string[]");
    imageUrls = r.imageUrls as string[];
  }
  return {
    patientId: r.patientId,
    notes: r.notes,
    transcript: r.transcript,
    imageUrls,
    diagnosisHint: r.diagnosisHint,
    sendTelegram: r.sendTelegram,
  };
}

// ─── /api/consult/telegram-send ─────────────────────────────────────────────
export interface TelegramSendRequest {
  /** Telegram chat ID to send to. Numeric string for user chats; @username also accepted. */
  chatId: string;
  /** The owner-facing message body (already has {clinic} interpolated by the caller). */
  body: string;
  /** Optional aftercare bullets appended below the body. */
  aftercare?: string[];
  /** Patient whose owner_telegram should be back-written on success. */
  patientId: string;
  /** Optional visit reference for audit. Not yet persisted but reserved. */
  visitId?: string;
}
export interface TelegramSendResponse {
  ok: true;
  messageId: number;
  chatIdSaved: boolean;
}
export function parseTelegramSendRequest(raw: unknown): TelegramSendRequest {
  const r = raw as Partial<TelegramSendRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.chatId !== "string" || !r.chatId.trim())
    throw new ApiError(400, "chatId required");
  // Accept either numeric ("123456789", "-1001234567890") or @username form.
  // Reject anything else early so we don't lean on Telegram's API for validation.
  const chatId = r.chatId.trim();
  const numeric = /^-?\d+$/.test(chatId);
  const username = /^@[a-zA-Z0-9_]{4,32}$/.test(chatId);
  if (!numeric && !username)
    throw new ApiError(400, "chatId must be numeric or @username");
  if (typeof r.body !== "string" || !r.body.trim())
    throw new ApiError(400, "body required");
  if (typeof r.patientId !== "string" || !r.patientId)
    throw new ApiError(400, "patientId required");
  let aftercare: string[] | undefined;
  if (r.aftercare !== undefined) {
    if (
      !Array.isArray(r.aftercare) ||
      r.aftercare.some((s) => typeof s !== "string")
    )
      throw new ApiError(400, "aftercare must be string[]");
    aftercare = r.aftercare as string[];
  }
  return {
    chatId,
    body: r.body,
    aftercare,
    patientId: r.patientId,
    visitId: typeof r.visitId === "string" ? r.visitId : undefined,
  };
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
