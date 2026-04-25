/**
 * Typed client for the /api/* routes. Server routes in app/api/*
 * remain the single source of truth for shape — this module is a
 * thin fetch wrapper so components don't hardcode URLs or shape.
 */
import type {
  ConsultRequest,
  ConsultResponse,
  CorrectionRequest,
  CorrectionResponse,
  GetAnalyticsResponse,
  GetBriefResponse,
  GetFollowupsResponse,
  GetMetricsResponse,
  GetPatientResponse,
  GetPatientsResponse,
  TriageRequest,
  TriageResponse,
} from "./api-types";

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postJSON<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  return getJSON<TRes>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  getPatients: () => getJSON<GetPatientsResponse>("/api/patients"),
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

  /** Multipart upload of one or more images to a Supabase Storage bucket. */
  uploadPhotos: async (
    files: File[],
    bucket: "consult-photos" | "owner-photos" = "consult-photos",
  ): Promise<{ uploads: { url?: string; base64?: string; mediaType: string }[] }> => {
    const fd = new FormData();
    fd.append("bucket", bucket);
    for (const f of files) fd.append("files", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  /** Multipart upload of an audio Blob; returns Deepgram transcript text. */
  transcribe: async (
    audio: Blob,
  ): Promise<{ transcript: string; confidence: number | null }> => {
    const fd = new FormData();
    fd.append("audio", audio, "consult.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};
