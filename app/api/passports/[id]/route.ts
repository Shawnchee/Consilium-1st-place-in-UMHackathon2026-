/**
 * GET /api/passports/[id]
 *
 * Returns the latest passport payload for a patient. Resolution order:
 *   1. Supabase `passports` row keyed by patient_id.
 *   2. In-memory fallback (dev-only, dies with the process).
 *   3. Synthesized payload — Milo demo seed for "p1", identity-only
 *      otherwise. Ensures /passport?pid=<anything-valid> never 404s.
 */

import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { rowToPatient, type PatientRow } from "@/lib/supabase-mappers";
import { PATIENTS } from "@/lib/data";
import {
  MILO_DEMO_PAYLOAD,
  buildIdentityPayload,
} from "@/lib/passport-fixtures";
import { passportMemory } from "@/lib/passport-store";
import type { GetPassportResponse } from "@/lib/api-types";
import type { PassportPayload, Patient } from "@/lib/types";

const PATIENT_COLS =
  "id,name,species,breed,age_years,sex,owner_name,owner_phone,owner_telegram";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!id) throw new ApiError(400, "id required");

    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        const { data, error } = await db
          .from("passports")
          .select("payload")
          .eq("patient_id", id)
          .maybeSingle<{ payload: PassportPayload }>();
        if (error) throw error;
        if (data?.payload) {
          return json<GetPassportResponse>({
            payload: data.payload,
            source: "supabase",
          });
        }
      } catch (dbErr) {
        console.warn("[api/passports] DB read error, falling back", dbErr);
      }
    }

    const fromMemory = passportMemory.get(id);
    if (fromMemory) {
      return json<GetPassportResponse>({
        payload: fromMemory,
        source: "memory",
      });
    }

    const synthesized = await synthesizeFallback(id);
    return json<GetPassportResponse>({
      payload: synthesized,
      source: "fixture",
    });
  } catch (err) {
    return errorResponse(err);
  }
}

async function synthesizeFallback(id: string): Promise<PassportPayload> {
  // Mock-mode demo path: pid "p1" is Milo cystotomy.
  if (id === "p1") return MILO_DEMO_PAYLOAD;

  const patient = await lookupPatient(id);
  if (!patient) throw new ApiError(404, `patient ${id} not found`);
  return buildIdentityPayload(patient);
}

async function lookupPatient(id: string): Promise<Patient | null> {
  if (hasSupabase()) {
    try {
      const db = getSupabaseServer();
      const { data, error } = await db
        .from("patients")
        .select(PATIENT_COLS)
        .eq("id", id)
        .maybeSingle<PatientRow>();
      if (error) throw error;
      if (data) return rowToPatient(data);
    } catch (dbErr) {
      console.warn("[api/passports] patient lookup failed", dbErr);
    }
  }
  return PATIENTS.find((p) => p.id === id) ?? null;
}
