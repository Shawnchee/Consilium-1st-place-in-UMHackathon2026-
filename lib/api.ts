import { getJSON, postJSON, uploadPhotos, transcribe } from "./api-base";
import type {
  GetPatientsResponse,
  CreatePatientRequest,
  CreatePatientResponse,
  GetPatientResponse,
  GetBriefResponse,
  GetFollowupsResponse,
  GetMetricsResponse,
  GetAnalyticsResponse,
  ConsultRequest,
  ConsultResponse,
  TriageRequest,
  TriageResponse,
  CorrectionRequest,
  CorrectionResponse,
  TelegramSendRequest,
  TelegramSendResponse,
  GetPassportResponse,
  PassportUpsertRequest,
  PassportUpsertResponse,
  CreateVisitRequest,
  CreateVisitResponse,
} from "./api-types";

export const api = {
  getPatients: () => getJSON<GetPatientsResponse>("/api/patients"),
  createPatient: (req: CreatePatientRequest) =>
    postJSON<CreatePatientRequest, CreatePatientResponse>("/api/patients", req),
  getPatient: (id: string) =>
    getJSON<GetPatientResponse>(`/api/patients?id=${encodeURIComponent(id)}`),
  evidenceCheck: (req: {
    patientName: string;
    patientSpecies: string;
    diagnosis: string;
    drugs: string[];
  }) =>
    postJSON<
      typeof req,
      {
        status: "clear" | "warning" | "unknown";
        summary: string;
        citations: { title: string; url: string }[];
        cached?: boolean;
        latencyMs: number;
      }
    >("/api/consult/evidence-check", req),
  setPatientTelegram: async (id: string, ownerTelegram: string | null) => {
    const resp = await fetch(`/api/patients?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerTelegram }),
    });
    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(error || `update failed (${resp.status})`);
    }
    return resp.json() as Promise<GetPatientResponse>;
  },
  deletePatient: async (id: string) => {
    const resp = await fetch(`/api/patients?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(error || `delete failed (${resp.status})`);
    }
    return resp.json() as Promise<{ ok: true; id: string }>;
  },
  getBrief: (patientId: string) =>
    getJSON<GetBriefResponse>(
      `/api/brief?patient_id=${encodeURIComponent(patientId)}`,
    ),
  getFollowups: () => getJSON<GetFollowupsResponse>("/api/followups"),
  getMetrics: () => getJSON<GetMetricsResponse>("/api/metrics"),
  getAnalytics: () => getJSON<GetAnalyticsResponse>("/api/analytics"),
  consult: (req: ConsultRequest) =>
    postJSON<ConsultRequest, ConsultResponse>("/api/consult", req),
  triage: (req: TriageRequest) =>
    postJSON<TriageRequest, TriageResponse>("/api/triage", req),
  correction: (req: CorrectionRequest) =>
    postJSON<CorrectionRequest, CorrectionResponse>("/api/corrections", req),
  createVisit: (req: {
    patientId: string;
    /** Optional — convenience for callers that already have it. The
     *  server only needs patientId, but logging benefits from the name. */
    patientName?: string;
    rawNotes: string;
    soap: any;
    prescription: any;
    billing: any;
    todos: any;
    /**
     * Optional Telegram chat id to link this visit to. When passed, the
     * server inserts a stub `followups` row so the bot can correlate
     * future owner messages to this visit. Required for the demo's
     * after-hours triage beat.
     */
    telegramChatId?: string;
  }) =>
    postJSON<any, { success: true; visitId: string; followupId: string | null }>(
      "/api/visits",
      req,
    ),
  telegramSend: (req: TelegramSendRequest) =>
    postJSON<TelegramSendRequest, TelegramSendResponse>(
      "/api/consult/telegram-send",
      req,
    ),
  getPassport: (patientId: string) =>
    getJSON<GetPassportResponse>(
      `/api/passports/${encodeURIComponent(patientId)}`,
    ),
  upsertPassport: (req: PassportUpsertRequest) =>
    postJSON<PassportUpsertRequest, PassportUpsertResponse>(
      "/api/passports",
      req,
    ),

  /** Multipart upload of one or more images to a Supabase Storage bucket. */
  uploadPhotos,
  /** Voice-to-text via Deepgram (used by the consult mic button). */
  transcribe,
};
