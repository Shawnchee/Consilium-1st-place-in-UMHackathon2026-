import { getSupabaseServer } from "@/lib/supabase";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { ApiError } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    if (!hasSupabase()) {
      throw new ApiError(503, "Supabase connection required");
    }

    const { patientId, rawNotes, soap, prescription, billing, todos } = await req.json();
    const db = getSupabaseServer();

    // 1. Insert into visits table
    const { data: visit, error: visitError } = await db
      .from("visits")
      .insert({
        patient_id: patientId,
        raw_notes: rawNotes,
        soap_note: JSON.stringify(soap),
        prescription: prescription,
        billing_items: billing,
        todo_list: todos,
      })
      .select()
      .single();

    if (visitError) throw visitError;

    return json({ success: true, visitId: visit.id });
  } catch (err) {
    return errorResponse(err);
  }
}
