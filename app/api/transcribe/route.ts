/**
 * POST /api/transcribe
 *
 * Browser MediaRecorder posts audio (multipart form, field "audio") to this
 * route; we forward to Deepgram's REST endpoint and return `{ transcript }`.
 *
 * Errors:
 *   400 — no audio file in request, or invalid form data
 *   503 — DEEPGRAM_API_KEY missing
 *   502 — Deepgram returned an error
 */

import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { ENV, hasDeepgram } from "@/lib/env";

const DG_URL_BASE = "https://api.deepgram.com/v1/listen";

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string; confidence?: number }>;
    }>;
  };
}

export async function POST(req: Request) {
  try {
    if (!hasDeepgram()) {
      throw new ApiError(503, "DEEPGRAM_API_KEY not set");
    }

    const form = await req.formData().catch(() => {
      throw new ApiError(400, "expected multipart/form-data with 'audio' field");
    });
    const file = form.get("audio");
    if (!(file instanceof Blob) || file.size === 0) {
      throw new ApiError(400, "audio file required");
    }

    const params = new URLSearchParams({
      model: ENV.deepgram.model,
      smart_format: "true",
      punctuate: "true",
      detect_language: "true",
    });

    const dgRes = await fetch(`${DG_URL_BASE}?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${ENV.deepgram.apiKey}`,
        "Content-Type": file.type || "audio/webm",
      },
      body: await file.arrayBuffer(),
    });

    if (!dgRes.ok) {
      const text = await dgRes.text().catch(() => "");
      throw new ApiError(502, `deepgram error ${dgRes.status}: ${text.slice(0, 200)}`);
    }

    const body = (await dgRes.json()) as DeepgramResponse;
    const alt = body.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alt?.transcript?.trim() ?? "";
    const confidence = alt?.confidence ?? null;

    return json({ transcript, confidence });
  } catch (err) {
    return errorResponse(err);
  }
}
