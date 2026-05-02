/**
 * POST /api/passports
 *
 * Doctor closes a consult → orchestrator output gets baked into a
 * passport payload (client-side via lib/passport-fixtures) → posted
 * here for persistence. Falls back to an in-memory store when Supabase
 * isn't configured (dev only — the close-case button is hidden in that
 * case, so this fallback is mostly for local testing).
 */

import { NextResponse } from "next/server";
import { ApiError, parsePassportUpsertRequest } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { passportMemory } from "@/lib/passport-store";
import type { PassportUpsertResponse } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const { patientId, payload } = parsePassportUpsertRequest(raw);

    const url = `/passport?pid=${encodeURIComponent(patientId)}`;

    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        const { error } = await db
          .from("passports")
          .upsert(
            {
              patient_id: patientId,
              share_uuid: payload.shareUuid,
              payload,
            },
            { onConflict: "patient_id" },
          );
        if (error) throw error;
        return json<PassportUpsertResponse>({
          ok: true,
          shareUuid: payload.shareUuid,
          url,
          source: "supabase",
        });
      } catch (dbErr) {
        const detail =
          dbErr instanceof Error
            ? dbErr.message
            : typeof dbErr === "object" && dbErr !== null
              ? (dbErr as { message?: string }).message ??
                JSON.stringify(dbErr)
              : String(dbErr);
        console.error("[api/passports] upsert failed", dbErr);
        return NextResponse.json(
          { error: `passport upsert failed: ${detail}` },
          { status: 502 },
        );
      }
    }

    // Mock-mode fallback — store in process memory so a subsequent GET
    // reflects the change. The doctor's close-case button is hidden in
    // mock mode (per UI gate) but tests / scripts can still POST.
    passportMemory.set(patientId, payload);
    return json<PassportUpsertResponse>({
      ok: true,
      shareUuid: payload.shareUuid,
      url,
      source: "memory",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
