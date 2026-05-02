import { getJSON, postJSON, uploadPhotos } from "./api-base";
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

  /** Multipart upload of one or more images to a Supabase Storage bucket. */
  uploadPhotos,
};
