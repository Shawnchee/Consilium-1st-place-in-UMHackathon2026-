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

    // Decide the Content-Type to forward to Deepgram. Some browsers /
    // multipart parsers strip the Blob type to application/octet-stream
    // — when that happens we infer from the uploaded filename's extension
    // so Deepgram still gets a useful Content-Type.
    let contentType = file.type;
    const fname =
      file instanceof File ? file.name.toLowerCase() : "";
    if (!contentType || contentType === "application/octet-stream") {
      if (fname.endsWith(".ogg")) contentType = "audio/ogg";
      else if (fname.endsWith(".mp4")) contentType = "audio/mp4";
      else if (fname.endsWith(".wav")) contentType = "audio/wav";
      else contentType = "audio/webm";
    }

    console.log(
      `[transcribe] received ${file.size}B, file.type="${file.type}", fname="${fname}", forwarding Content-Type="${contentType}"`,
    );

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
        "Content-Type": contentType,
      },
      body: await file.arrayBuffer(),
    });

    if (!dgRes.ok) {
      const text = await dgRes.text().catch(() => "");
      console.warn(
        `[transcribe] deepgram rejected: status=${dgRes.status}, body=${text.slice(0, 300)}`,
      );
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
