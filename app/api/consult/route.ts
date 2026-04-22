import { PATIENTS } from "@/lib/data";
import { ApiError, parseConsultRequest } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { callGLM } from "@/lib/glm";
import type { ConsultOutput } from "@/lib/types";
import type { ConsultResponse } from "@/lib/api-types";

type PatientLookup = { id: string; name: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const { patientId, notes } = parseConsultRequest(body);

    let patient: PatientLookup | null = null;

    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        const { data, error } = await db
          .from("patients")
          .select("id,name")
          .eq("id", patientId)
          .maybeSingle<PatientLookup>();
        if (error) throw error;
        if (data) patient = data;
      } catch (dbErr) {
        console.warn("[api/consult] DB lookup error, falling back to mock", dbErr);
      }
    }

    if (!patient) {
      const p = PATIENTS.find((x) => x.id === patientId);
      if (!p) throw new ApiError(404, `patient ${patientId} not found`);
      patient = { id: p.id, name: p.name };
    }

    const result = await callGLM<ConsultOutput>({
      feature: "consult",
      user: notes,
      context: { patientName: patient.name, patientId },
    });

    let visitId = `mock-visit-${Date.now()}`;

    // Best-effort persist — never fail the request if DB write errors.
    if (hasSupabaseAdmin()) {
      try {
        const db = getSupabaseServer();
        const soapText = [
          `S: ${result.data.soap.S}`,
          `O: ${result.data.soap.O}`,
          `A: ${result.data.soap.A}`,
          `P: ${result.data.soap.P}`,
        ].join("\n");
        const { data: inserted, error } = await db
          .from("visits")
          .insert({
            patient_id: patientId,
            raw_notes: notes,
            soap_note: soapText,
            prescription: result.data.prescription,
            billing_items: result.data.billing,
            todo_list: result.data.todos,
          })
          .select("id")
          .maybeSingle<{ id: string }>();
        if (error) throw error;
        if (inserted?.id) visitId = inserted.id;
      } catch (dbErr) {
        console.warn("[api/consult] visit insert failed, continuing", dbErr);
      }
    }

    return json<ConsultResponse>({
      visitId,
      output: result.data,
      source: result.source,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
