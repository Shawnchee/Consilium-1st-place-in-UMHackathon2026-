/**
 * POST /api/upload
 *
 * Multipart in: one or more files in the "files" field, plus a "bucket" text
 * field ("consult-photos" | "owner-photos").
 *
 * Returns: { uploads: { url?: string; base64?: string; mediaType: string }[] }
 *
 * Falls back to inline base64 when Supabase admin credentials or the bucket
 * are missing — callers can pass either url or base64 to /api/consult.
 */

import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { uploadPhotoBytes, type PhotoBucket } from "@/lib/storage";

const ALLOWED_BUCKETS: PhotoBucket[] = ["consult-photos", "owner-photos"];
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file
const MAX_FILES = 6;

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => {
      throw new ApiError(400, "expected multipart/form-data with 'files'");
    });

    const bucketRaw = form.get("bucket");
    const bucket = (typeof bucketRaw === "string" ? bucketRaw : "consult-photos") as PhotoBucket;
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      throw new ApiError(400, `bucket must be one of ${ALLOWED_BUCKETS.join(", ")}`);
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new ApiError(400, "at least one file required");
    if (files.length > MAX_FILES) {
      throw new ApiError(400, `too many files (max ${MAX_FILES})`);
    }

    for (const f of files) {
      if (f.size === 0) throw new ApiError(400, `empty file: ${f.name}`);
      if (f.size > MAX_FILE_BYTES) {
        throw new ApiError(413, `file ${f.name} exceeds ${MAX_FILE_BYTES} bytes`);
      }
      if (!f.type.startsWith("image/")) {
        throw new ApiError(400, `file ${f.name} is not an image (type=${f.type})`);
      }
    }

    const uploads = await Promise.all(
      files.map(async (f) => {
        const buf = await f.arrayBuffer();
        return uploadPhotoBytes(bucket, buf, f.type);
      }),
    );

    return json({ uploads });
  } catch (err) {
    return errorResponse(err);
  }
}
