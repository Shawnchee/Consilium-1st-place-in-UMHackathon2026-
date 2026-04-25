/**
 * Image upload helper.
 *
 * Tries Supabase Storage first (returns a public URL Claude can fetch
 * directly). Falls back to inline base64 when Supabase admin credentials
 * are missing or the bucket doesn't exist yet — Claude vision works either
 * way, but URL upload preserves the audit trail and unlocks dashboard
 * thumbnails.
 *
 * Buckets are pre-created by `supabase/migrations/0005_storage_buckets.sql`.
 * Two public buckets:
 *   - consult-photos  → vet-uploaded media during F2 capture
 *   - owner-photos    → owner-sent photos forwarded by the Telegram bot
 */

import { hasSupabaseAdmin } from "./env";
import { getSupabaseServer } from "./supabase";
import type { LLMImage } from "./llm";

export type PhotoBucket = "consult-photos" | "owner-photos";

export type AnyMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

function extFor(mediaType: AnyMediaType): string {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/gif") return "gif";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}

function pickMediaType(input: string | undefined): AnyMediaType {
  const lower = (input ?? "").toLowerCase();
  if (lower.includes("png")) return "image/png";
  if (lower.includes("gif")) return "image/gif";
  if (lower.includes("webp")) return "image/webp";
  return "image/jpeg";
}

function randomKey(): string {
  // crypto.randomUUID is in Node 20+ and modern browsers (we run server-side here).
  return crypto.randomUUID();
}

/**
 * Upload to Supabase Storage if available, otherwise return base64 inline.
 * Either way the result plugs straight into `callGLM({ images: [...] })`.
 */
export async function uploadPhotoBytes(
  bucket: PhotoBucket,
  bytes: ArrayBuffer | Uint8Array,
  mediaTypeRaw: string | undefined,
): Promise<LLMImage> {
  const mediaType = pickMediaType(mediaTypeRaw);
  const buffer =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (hasSupabaseAdmin()) {
    try {
      const db = getSupabaseServer();
      const path = `${randomKey()}.${extFor(mediaType)}`;
      const { error } = await db.storage.from(bucket).upload(path, buffer, {
        contentType: mediaType,
        upsert: false,
      });
      if (!error) {
        const { data } = db.storage.from(bucket).getPublicUrl(path);
        return { url: data.publicUrl, mediaType };
      }
      console.warn(
        `[storage] upload to ${bucket} failed (${error.message}); falling back to base64`,
      );
    } catch (err) {
      console.warn(`[storage] ${bucket} upload threw; falling back to base64`, err);
    }
  }

  return {
    base64: Buffer.from(buffer).toString("base64"),
    mediaType,
  };
}
