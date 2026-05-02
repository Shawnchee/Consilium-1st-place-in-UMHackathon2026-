import { PATIENTS } from "@/lib/data";
import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { rowToPatient, type PatientRow } from "@/lib/supabase-mappers";
import type {
  GetPatientResponse,
  GetPatientsResponse,
  CreatePatientResponse,
} from "@/lib/api-types";
import { parseCreatePatientRequest } from "@/lib/api-types";

const PATIENT_COLS =
  "id,name,species,breed,age_years,sex,owner_name,owner_phone,owner_telegram,reason_for_visit";

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

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const payload = parseCreatePatientRequest(raw);

    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        const { data, error } = await db
          .from("patients")
          .insert({
            name: payload.name,
            species: payload.species,
            breed: payload.breed,
            age_years: payload.age,
            sex: payload.sex,
            owner_name: payload.ownerName,
            owner_phone: payload.ownerPhone,
            reason_for_visit: payload.reasonForVisit ?? null,
          })
          .select(PATIENT_COLS)
          .single<PatientRow>();

        if (error) throw error;
        if (!data) throw new ApiError(500, "Failed to insert patient");
        
        return json<CreatePatientResponse>({ patient: rowToPatient(data) });
      } catch (dbErr) {
        if (dbErr instanceof ApiError) throw dbErr;
        console.warn("[api/patients] DB insert error", dbErr);
        throw new ApiError(500, "Database error");
      }
    }
    
    throw new ApiError(503, "Supabase connection is required to create patients.");
  } catch (err) {
    return errorResponse(err);
  }
}
