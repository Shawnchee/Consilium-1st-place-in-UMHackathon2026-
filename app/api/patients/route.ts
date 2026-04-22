import { PATIENTS } from "@/lib/data";
import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { rowToPatient, type PatientRow } from "@/lib/supabase-mappers";
import type {
  GetPatientResponse,
  GetPatientsResponse,
} from "@/lib/api-types";

const PATIENT_COLS =
  "id,name,species,breed,age_years,sex,owner_name,owner_phone,owner_telegram";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");

    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        if (id) {
          const { data, error } = await db
            .from("patients")
            .select(PATIENT_COLS)
            .eq("id", id)
            .maybeSingle<PatientRow>();
          if (error) throw error;
          if (!data) throw new ApiError(404, `patient ${id} not found`);
          return json<GetPatientResponse>({ patient: rowToPatient(data) });
        }
        const { data, error } = await db
          .from("patients")
          .select(PATIENT_COLS)
          .order("created_at", { ascending: true })
          .returns<PatientRow[]>();
        if (error) throw error;
        return json<GetPatientsResponse>({
          patients: (data ?? []).map(rowToPatient),
        });
      } catch (dbErr) {
        if (dbErr instanceof ApiError) throw dbErr;
        console.warn("[api/patients] DB error, falling back to mock", dbErr);
      }
    }

    // Mock fallback
    if (id) {
      const patient = PATIENTS.find((p) => p.id === id);
      if (!patient) throw new ApiError(404, `patient ${id} not found`);
      return json<GetPatientResponse>({ patient });
    }
    return json<GetPatientsResponse>({ patients: PATIENTS });
  } catch (err) {
    return errorResponse(err);
  }
}
