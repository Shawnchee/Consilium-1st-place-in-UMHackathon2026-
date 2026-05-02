import { ApiError, parseCorrectionRequest } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import type { CorrectionResponse } from "@/lib/api-types";
import { getSupabaseServer } from "@/lib/supabase";
import { hasSupabaseAdmin } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const correction = parseCorrectionRequest(body);
    
    let id = `mock-correction-${Date.now()}`;
    
    if (hasSupabaseAdmin()) {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from("corrections")
        .insert({
          visit_id: correction.visitId,
          followup_id: correction.followupId,
          feature: correction.feature,
          glm_output: correction.glmOutput,
          rejection_reason: correction.rejectionReason,
          doctor_correction: correction.doctorCorrection,
          approved: correction.approved,
        })
        .select("id")
        .single();
        
      if (error) {
        throw new ApiError(500, "Failed to save correction to database");
      }
      id = data.id;
    }

    // Log for visibility
    console.log(
      `[corrections] ${id} feature=${correction.feature} approved=${correction.approved}` +
        (correction.rejectionReason ? ` reason=${correction.rejectionReason}` : "")
    );
    return json<CorrectionResponse>({ ok: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
