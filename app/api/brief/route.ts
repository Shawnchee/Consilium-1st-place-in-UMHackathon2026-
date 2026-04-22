import { PATIENTS } from "@/lib/data";
import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { callGLM } from "@/lib/glm";
import type { PatientRow } from "@/lib/supabase-mappers";
import type { Brief } from "@/lib/types";
import type { GetBriefResponse } from "@/lib/api-types";

const PATIENT_COLS =
  "id,name,species,breed,age_years,sex,owner_name,owner_phone,owner_telegram";

// Brief generation now flows through callGLM (mock → real on Phase 5-real swap).
// Supabase still resolves the patient row; GLM generates the 5-line summary.
export async function GET(req: Request) {
  try {
    const patientId = new URL(req.url).searchParams.get("patient_id");
    if (!patientId) throw new ApiError(400, "patient_id required");

    let patientName: string | null = null;
    let userContext = "";

    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        const { data, error } = await db
          .from("patients")
          .select(PATIENT_COLS)
          .eq("id", patientId)
          .maybeSingle<PatientRow>();
        if (error) throw error;
        if (!data) throw new ApiError(404, `patient ${patientId} not found`);
        patientName = data.name;
        userContext = `Patient: ${data.name}, ${data.species ?? "unknown species"} ${
          data.breed ?? ""
        }, ${data.age_years ?? "?"}yo. Owner: ${data.owner_name ?? "?"}.`;
      } catch (dbErr) {
        if (dbErr instanceof ApiError) throw dbErr;
        console.warn("[api/brief] DB error, falling back to mock", dbErr);
      }
    }

    if (!patientName) {
      const patient = PATIENTS.find((p) => p.id === patientId);
      if (!patient) throw new ApiError(404, `patient ${patientId} not found`);
      patientName = patient.name;
      userContext = `Patient: ${patient.name}, ${patient.species} ${patient.breed}, ${patient.age}. Owner: ${patient.owner}. Reason: ${patient.reason}`;
    }

    const result = await callGLM<Brief>({
      feature: "brief",
      user: userContext,
      context: { patientName, patientId },
    });

    return json<GetBriefResponse>({
      patientId,
      brief: result.data,
      source: result.source,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
