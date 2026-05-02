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

/** Multipart upload of one or more images to a Supabase Storage bucket. */
export async function uploadPhotos(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const resp = await fetch("/api/storage/upload", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error || "Upload failed");
  }

  const { urls } = await resp.json();
  return urls;
}
