import { INITIAL_FOLLOWUPS } from "@/lib/data";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import {
  isResolvedStatus,
  rowToFollowUp,
  type FollowupRow,
} from "@/lib/supabase-mappers";
import {
  ApiError,
  parseUpdateFollowupRequest,
  type GetFollowupsResponse,
} from "@/lib/api-types";

const SELECT =
  "id,status,owner_message,recommended_action,draft_response,glm_decision,differentials,conversation,tool_call_count,sent_at,created_at,telegram_chat_id,visits(id,visit_date,raw_notes,patients(id,name,owner_name))";

export async function GET() {
  try {
    if (hasSupabase()) {
      try {
        const db = getSupabaseServer();
        const { data, error } = await db
          .from("followups")
          .select(SELECT)
          .order("sent_at", { ascending: false, nullsFirst: false })
          .returns<FollowupRow[]>();
        if (error) throw error;
        const rows = data ?? [];
        return json<GetFollowupsResponse>({
          followups: rows.map(rowToFollowUp),
          resolvedCount: rows.filter((r) => isResolvedStatus(r.status)).length,
        });
      } catch (dbErr) {
        console.warn("[api/followups] DB error, falling back to mock", dbErr);
      }
    }

    return json<GetFollowupsResponse>({
      followups: INITIAL_FOLLOWUPS,
      resolvedCount: 12,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    if (!hasSupabase()) {
      return json({ ok: true });
    }

    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const { id, status, draft } = parseUpdateFollowupRequest(body);

    const db = getSupabaseServer();
    const updateData: any = {};
    if (status) updateData.status = status;
    if (draft !== undefined) updateData.draft_response = draft;

    const { error } = await db
      .from("followups")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
