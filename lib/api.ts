import { getJSON, postJSON, transcribe, uploadPhotos } from "./api-base";
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
} from "./api-types";

export const api = {
  getPatients: () => getJSON<GetPatientsResponse>("/api/patients"),
  createPatient: (req: CreatePatientRequest) =>
    postJSON<CreatePatientRequest, CreatePatientResponse>("/api/patients", req),
  getPatient: (id: string) =>
    getJSON<GetPatientResponse>(`/api/patients?id=${encodeURIComponent(id)}`),
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
    rawNotes: string;
    soap: any; 
    prescription: any; 
    billing: any; 
    todos: any 
  }) => postJSON<any, any>("/api/visits", req),
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
