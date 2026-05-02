/**
 * Shared fetch wrappers for Next.js client-side API calls.
 */

export async function getJSON<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error || `GET ${url} failed with status ${resp.status}`);
  }
  return resp.json();
}

export async function postJSON<Req, Res>(url: string, body: Req): Promise<Res> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error || `POST ${url} failed with status ${resp.status}`);
  }
  return resp.json();
}

/**
 * Multipart upload of one or more images. Returns the route's full
 * response so callers can either use the public URL (Supabase configured)
 * or fall back to the inline base64 + mediaType.
 */
export async function uploadPhotos(
  files: File[],
  bucket: "consult-photos" | "owner-photos" = "consult-photos",
): Promise<{
  uploads: { url?: string; base64?: string; mediaType: string }[];
}> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("bucket", bucket);

  const resp = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error || "Upload failed");
  }

  return resp.json();
}

/** POST a recorded audio Blob to /api/transcribe (Deepgram). */
export async function transcribe(
  audio: Blob,
): Promise<{ transcript: string; confidence: number | null }> {
  // FormData.append(blob) without a filename loses the Blob's MIME on
  // the server — the route then forwards application/octet-stream to
  // Deepgram, which rejects with "corrupt or unsupported data". Pass
  // a filename whose extension matches the recorded MIME so the type
  // round-trips through multipart parsing intact.
  const ext = audio.type.includes("ogg")
    ? "ogg"
    : audio.type.includes("mp4")
      ? "mp4"
      : audio.type.includes("wav")
        ? "wav"
        : "webm";
  const formData = new FormData();
  formData.append("audio", audio, `recording.${ext}`);
  const resp = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error || "Transcribe failed");
  }
  return resp.json();
}
