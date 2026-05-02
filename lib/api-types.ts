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
  PassportPayload,
  SoapNote,
  PrescriptionItem,
  BillingItem,
  TodoItem,
} from "./types";

// ─── /api/patients ──────────────────────────────────────────────────────────
export type GetPatientsResponse = { patients: Patient[] };
export type GetPatientResponse = { patient: Patient };

export interface CreatePatientRequest {
  name: string;
  species: string;
  breed: string;
  age: number;
  sex: "Male" | "Female";
  ownerName: string;
  ownerPhone: string;
  reasonForVisit?: string;
}
export type CreatePatientResponse = { patient: Patient };

const MAX_REASON_FOR_VISIT_LEN = 500;

export function parseCreatePatientRequest(raw: unknown): CreatePatientRequest {
  const r = raw as Partial<CreatePatientRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.name !== "string" || !r.name.trim()) throw new ApiError(400, "name required");
  if (typeof r.species !== "string" || !r.species.trim()) throw new ApiError(400, "species required");
  if (typeof r.breed !== "string") throw new ApiError(400, "breed required");
  if (typeof r.age !== "number" || !Number.isFinite(r.age) || r.age < 0)
    throw new ApiError(400, "age must be a non-negative number"); if (r.sex !== "Male" && r.sex !== "Female") throw new ApiError(400, "sex must be Male or Female");
  if (typeof r.ownerName !== "string" || !r.ownerName.trim()) throw new ApiError(400, "ownerName required");
  if (typeof r.ownerPhone !== "string") throw new ApiError(400, "ownerPhone required");

  let reasonForVisit: string | undefined;
  if (r.reasonForVisit !== undefined && r.reasonForVisit !== null && r.reasonForVisit !== "") {
    if (typeof r.reasonForVisit !== "string")
      throw new ApiError(400, "reasonForVisit must be string");
    if (r.reasonForVisit.length > MAX_REASON_FOR_VISIT_LEN)
      throw new ApiError(413, `reasonForVisit exceeds ${MAX_REASON_FOR_VISIT_LEN} chars`);
    reasonForVisit = r.reasonForVisit;
  }

  return {
    name: r.name,
    species: r.species,
    breed: r.breed,
    age: r.age,
    sex: r.sex,
    ownerName: r.ownerName,
    ownerPhone: r.ownerPhone,
    reasonForVisit,
  };
}

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
// Hard caps so an unauthenticated caller can't run up an Anthropic bill
// with a 10MB notes blob fan-out across five Haiku sub-agents + Sonnet.
// 20k chars of notes ≈ 5k tokens, plenty for a thorough consult; same for
// transcript. 8 image URLs is more than any realistic consult needs.
const MAX_NOTES_LEN = 20_000;
const MAX_TRANSCRIPT_LEN = 30_000;
const MAX_DIAGNOSIS_HINT_LEN = 500;
const MAX_IMAGE_URLS = 8;
const MAX_IMAGE_URL_LEN = 2_000;
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
  if (r.patientId.length > 100)
    throw new ApiError(400, "patientId too long");
  if (typeof r.notes !== "string" || !r.notes.trim())
    throw new ApiError(400, "notes required");
  if (r.notes.length > MAX_NOTES_LEN)
    throw new ApiError(413, `notes exceeds ${MAX_NOTES_LEN} chars`);
  if (r.transcript !== undefined) {
    if (typeof r.transcript !== "string")
      throw new ApiError(400, "transcript must be string");
    if (r.transcript.length > MAX_TRANSCRIPT_LEN)
      throw new ApiError(413, `transcript exceeds ${MAX_TRANSCRIPT_LEN} chars`);
  }
  if (r.diagnosisHint !== undefined) {
    if (typeof r.diagnosisHint !== "string")
      throw new ApiError(400, "diagnosisHint must be string");
    if (r.diagnosisHint.length > MAX_DIAGNOSIS_HINT_LEN)
      throw new ApiError(413, `diagnosisHint exceeds ${MAX_DIAGNOSIS_HINT_LEN} chars`);
  }
  if (r.sendTelegram !== undefined && typeof r.sendTelegram !== "boolean")
    throw new ApiError(400, "sendTelegram must be boolean");
  let imageUrls: string[] | undefined;
  if (r.imageUrls !== undefined) {
    if (!Array.isArray(r.imageUrls) || r.imageUrls.some((u) => typeof u !== "string"))
      throw new ApiError(400, "imageUrls must be string[]");
    if (r.imageUrls.length > MAX_IMAGE_URLS)
      throw new ApiError(413, `imageUrls exceeds ${MAX_IMAGE_URLS} entries`);
    if (r.imageUrls.some((u) => (u as string).length > MAX_IMAGE_URL_LEN))
      throw new ApiError(413, `image URL exceeds ${MAX_IMAGE_URL_LEN} chars`);
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
  /** Patient name for the followup record. */
  patientName: string;
  /** Optional visit reference for audit. */
  visitId?: string;
  /** Initial status for the followup (e.g. 'monitor'). */
  status?: string;
  /** The recommendation text for the followup dashboard. */
  recommendedAction?: string;
}
export interface TelegramSendResponse {
  ok: true;
  messageId: number;
  chatIdSaved: boolean;
}
// Telegram message limits: the API rejects > 4096 chars; cap a little
// below that to leave room for the aftercare suffix the route appends.
const MAX_TG_BODY_LEN = 3_500;
const MAX_TG_AFTERCARE_ITEMS = 12;
const MAX_TG_AFTERCARE_ITEM_LEN = 200;
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
  if (r.body.length > MAX_TG_BODY_LEN)
    throw new ApiError(413, `body exceeds ${MAX_TG_BODY_LEN} chars`);
  if (typeof r.patientId !== "string" || !r.patientId)
    throw new ApiError(400, "patientId required");
  if (r.patientId.length > 100)
    throw new ApiError(400, "patientId too long");
  if (typeof r.patientName !== "string" || !r.patientName.trim())
    throw new ApiError(400, "patientName required");
  let aftercare: string[] | undefined;
  if (r.aftercare !== undefined) {
    if (
      !Array.isArray(r.aftercare) ||
      r.aftercare.some((s) => typeof s !== "string")
    )
      throw new ApiError(400, "aftercare must be string[]");
    if (r.aftercare.length > MAX_TG_AFTERCARE_ITEMS)
      throw new ApiError(
        413,
        `aftercare exceeds ${MAX_TG_AFTERCARE_ITEMS} items`,
      );
    if (
      r.aftercare.some(
        (s) => (s as string).length > MAX_TG_AFTERCARE_ITEM_LEN,
      )
    )
      throw new ApiError(
        413,
        `aftercare item exceeds ${MAX_TG_AFTERCARE_ITEM_LEN} chars`,
      );
    aftercare = r.aftercare as string[];
  }
  return {
    chatId,
    body: r.body,
    aftercare,
    patientId: r.patientId,
    patientName: r.patientName,
    visitId: typeof r.visitId === "string" ? r.visitId : undefined,
    status: typeof r.status === "string" ? r.status : undefined,
    recommendedAction: typeof r.recommendedAction === "string" ? r.recommendedAction : undefined,
  };
}

// ─── /api/passports ─────────────────────────────────────────────────────────
export interface GetPassportResponse {
  payload: PassportPayload;
  source: "supabase" | "memory" | "fixture";
}

export interface PassportUpsertRequest {
  patientId: string;
  payload: PassportPayload;
}

export interface PassportUpsertResponse {
  ok: true;
  shareUuid: string;
  /** Path-relative passport URL (e.g. "/passport?pid=abc"). Caller composes the absolute URL. */
  url: string;
  source: "supabase" | "memory";
}

const MAX_PASSPORT_PAYLOAD_BYTES = 64_000;

export function parsePassportUpsertRequest(
  raw: unknown,
): PassportUpsertRequest {
  const r = raw as Partial<PassportUpsertRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.patientId !== "string" || !r.patientId.trim())
    throw new ApiError(400, "patientId required");
  if (r.patientId.length > 100)
    throw new ApiError(400, "patientId too long");
  if (!r.payload || typeof r.payload !== "object")
    throw new ApiError(400, "payload required");

  // Quick size guard so a runaway client can't write a giant JSON blob.
  const size = JSON.stringify(r.payload).length;
  if (size > MAX_PASSPORT_PAYLOAD_BYTES)
    throw new ApiError(413, `payload exceeds ${MAX_PASSPORT_PAYLOAD_BYTES} bytes`);

  const p = r.payload as Partial<PassportPayload>;
  if (!p.identity || typeof p.identity !== "object")
    throw new ApiError(400, "payload.identity required");
  if (typeof (p.identity as { name?: unknown }).name !== "string")
    throw new ApiError(400, "payload.identity.name required");
  if (typeof p.shareUuid !== "string" || !p.shareUuid)
    throw new ApiError(400, "payload.shareUuid required");
  if (!Array.isArray(p.vaccinations) || !Array.isArray(p.visits) || !Array.isArray(p.activeMeds))
    throw new ApiError(400, "payload arrays required");

  return {
    patientId: r.patientId,
    payload: r.payload as PassportPayload,
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
export interface UpdateFollowupRequest {
  id: string;
  status?: string;
  draft?: string;
}
export type UpdateFollowupResponse = { ok: true };
export function parseUpdateFollowupRequest(raw: unknown): UpdateFollowupRequest {
  const r = raw as Partial<UpdateFollowupRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.id !== "string" || !r.id) throw new ApiError(400, "id required");
  return { id: r.id, status: r.status, draft: r.draft };
}

// ─── /api/metrics ───────────────────────────────────────────────────────────
export type GetMetricsResponse = { metrics: MetricCardData[] };

// ─── /api/analytics ─────────────────────────────────────────────────────────
export type GetAnalyticsResponse = {
  diagnoses: DiagnosisRow[];
  corrections: CorrectionRow[];
};

// ─── /api/visits ────────────────────────────────────────────────────────────
export interface CreateVisitRequest {
  patientId: string;
  patientName?: string;
  telegramChatId?: string;
  rawNotes: string;
  soap: SoapNote;
  prescription: PrescriptionItem[];
  billing: BillingItem[];
  todos: TodoItem[];
}
export type CreateVisitResponse = {
  visit: { id: string };
};
export function parseCreateVisitRequest(raw: unknown): CreateVisitRequest {
  const r = raw as Partial<CreateVisitRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.patientId !== "string" || !r.patientId)
    throw new ApiError(400, "patientId required");
  if (typeof r.rawNotes !== "string") throw new ApiError(400, "rawNotes required");
  if (!r.soap || typeof r.soap !== "object" || Array.isArray(r.soap))
    throw new ApiError(400, "soap must be an object");
  if (!r.prescription || !Array.isArray(r.prescription))
    throw new ApiError(400, "prescription must be an array");
  if (!r.billing || !Array.isArray(r.billing))
    throw new ApiError(400, "billing must be an array");
  if (!r.todos || !Array.isArray(r.todos))
    throw new ApiError(400, "todos must be an array");

  return {
    patientId: r.patientId,
    patientName: r.patientName,
    telegramChatId: r.telegramChatId,
    rawNotes: r.rawNotes,
    soap: r.soap as SoapNote,
    prescription: r.prescription as PrescriptionItem[],
    billing: r.billing as BillingItem[],
    todos: r.todos as TodoItem[],
  };
}

// ─── /api/corrections ───────────────────────────────────────────────────────
export interface CorrectionRequest {
  feature: "triage" | "billing" | "prescription" | "brief" | "soap" | "todos";
  visitId?: string;
  followupId?: string;
  glmOutput: string;
  glmTriage?: string;
  rejectionReason?: string;
  doctorCorrection?: string;
  doctorTriage?: string;
  approved: boolean;
}
export type CorrectionResponse = { ok: true; id: string };
export function parseCorrectionRequest(raw: unknown): CorrectionRequest {
  const r = raw as Partial<CorrectionRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  const features = ["triage", "billing", "prescription", "brief", "soap", "todos"] as const;
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
    glmTriage: r.glmTriage,
    rejectionReason: r.rejectionReason,
    doctorCorrection: r.doctorCorrection,
    doctorTriage: r.doctorTriage,
    approved: r.approved,
  };
}

// ─── /api/knowledge ─────────────────────────────────────────────────────────
export interface KnowledgeRule {
  action: string;
  condition?: string;
  added_date: string;
  last_reinforced_at: string;
  pinned: boolean;
  verified: boolean;
}
export interface KnowledgeTrend {
  label: string; // e.g. "Common Diagnoses"
  summary: string;
  is_persisting: boolean;
  last_seen: string;
}
export type GetKnowledgeResponse = {
  rules: KnowledgeRule[];
  trends: KnowledgeTrend[];
  updatedAt: string;
};
export interface UpdateKnowledgeRequest {
  rules: KnowledgeRule[];
}
export function parseUpdateKnowledgeRequest(raw: unknown): UpdateKnowledgeRequest {
  const r = raw as Partial<UpdateKnowledgeRequest>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (!Array.isArray(r.rules)) throw new ApiError(400, "rules must be an array");
  return { rules: r.rules as KnowledgeRule[] };
}

// ─── errors ─────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
