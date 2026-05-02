import { INITIAL_FOLLOWUPS } from "@/lib/data";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import {
  isResolvedStatus,
  rowToFollowUp,
  type FollowupRow,
} from "@/lib/supabase-mappers";
import type { GetFollowupsResponse } from "@/lib/api-types";

const SELECT =
  "id,status,owner_message,recommended_action,draft_response,differentials,conversation,tool_call_count,sent_at,created_at,telegram_chat_id,visits(visit_date,raw_notes,patients(id,name,owner_name))";

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
