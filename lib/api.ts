import { getJSON, postJSON, postForm, uploadPhotos } from "./api-base";
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
  CreateVisitRequest,
  CreateVisitResponse,
  UpdateFollowupRequest,
  UpdateFollowupResponse,
  GetKnowledgeResponse,
  UpdateKnowledgeRequest,
} from "./api-types";

export const api = {
  getPatients: () => getJSON<GetPatientsResponse>("/api/patients"),
  createPatient: (req: CreatePatientRequest) =>
    postJSON<CreatePatientRequest, CreatePatientResponse>("/api/patients", req),
  getPatient: (id: string) =>
    getJSON<GetPatientResponse>(`/api/patients?id=${encodeURIComponent(id)}`),
  getBrief: (patientId: string) =>
    getJSON<GetBriefResponse>(
      `/api/brief?patient_id=${encodeURIComponent(patientId)}`,
    ),
  getFollowups: () => getJSON<GetFollowupsResponse>("/api/followups"),
  updateFollowup: (req: UpdateFollowupRequest) =>
    postJSON<UpdateFollowupRequest, UpdateFollowupResponse>("/api/followups", req),
  getMetrics: () => getJSON<GetMetricsResponse>("/api/metrics"),
  getAnalytics: () => getJSON<GetAnalyticsResponse>("/api/analytics"),
  consult: (req: ConsultRequest) =>
    postJSON<ConsultRequest, ConsultResponse>("/api/consult", req),
  triage: (req: TriageRequest) =>
    postJSON<TriageRequest, TriageResponse>("/api/triage", req),
  correction: (req: CorrectionRequest) =>
    postJSON<CorrectionRequest, CorrectionResponse>("/api/corrections", req),
  createVisit: (req: CreateVisitRequest) =>
    postJSON<CreateVisitRequest, CreateVisitResponse>("/api/visits", req),
  telegramSend: (req: TelegramSendRequest) =>
    postJSON<TelegramSendRequest, TelegramSendResponse>(
      "/api/consult/telegram-send",
      req,
    ),
  getKnowledge: () => getJSON<GetKnowledgeResponse>("/api/knowledge"),
  updateKnowledge: (req: UpdateKnowledgeRequest) =>
    postJSON<UpdateKnowledgeRequest, { ok: boolean }>("/api/knowledge", req),

  transcribe: (blob: Blob) => {
    const fd = new FormData();
    fd.append("audio", blob);
    return postForm<{ transcript: string }>("/api/transcribe", fd);
  },

  /** Multipart upload of one or more images to a Supabase Storage bucket. */
  uploadPhotos,
};
