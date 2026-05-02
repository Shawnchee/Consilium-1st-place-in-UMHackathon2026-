/**
 * POST /api/visits
 *
 * Inserts a visit row from the consult orchestrator output. When the
 * caller passes `telegramChatId`, also inserts a stub `followups` row
 * with status='pending' and that chat id — this is what lets the
 * downstream Telegram bot (`lib/telegram-handler.ts`) recognise future
 * owner messages from that chat and triage them against THIS visit.
 *
 * Without the followup row the bot sees `no followup linked to chat
 * <id>` and replies with the unlinked help text — frustrating during
 * a live demo. Creating the row here closes that loop.
 */

import { getSupabaseServer } from "@/lib/supabase";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabase } from "@/lib/env";
import { ApiError } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    if (!hasSupabase()) {
      throw new ApiError(503, "Supabase connection required");
    }

    const {
      patientId,
      rawNotes,
      soap,
      prescription,
      billing,
      todos,
      telegramChatId,
    } = await req.json();
    if (!patientId) throw new ApiError(400, "patientId required");
    const db = getSupabaseServer();

    // 1. Visit row
    const { data: visit, error: visitError } = await db
      .from("visits")
      .insert({
        patient_id: patientId,
        raw_notes: rawNotes,
        soap_note: typeof soap === "string" ? soap : JSON.stringify(soap),
        prescription,
        billing_items: billing,
        todo_list: todos,
      })
      .select("id")
      .single();
    if (visitError) throw visitError;

    // 2. Stub followup tied to the chat — only when a chat id was
    //    supplied. We never create unlinked followups since the bot
    //    can't do anything with them.
    let followupId: string | null = null;
    if (typeof telegramChatId === "string" && telegramChatId.trim()) {
      const { data: fu, error: fuErr } = await db
        .from("followups")
        .insert({
          visit_id: visit.id,
          status: "pending",
          telegram_chat_id: telegramChatId.trim(),
        })
        .select("id")
        .maybeSingle<{ id: string }>();
      if (fuErr) {
        // Followup creation is best-effort — visit is already saved.
        // Surface the failure in the response so the client can warn,
        // but don't roll back the visit.
        return json({
          success: true,
          visitId: visit.id,
          followupId: null,
          followupError: fuErr.message,
        });
      }
      followupId = fu?.id ?? null;
    }

    return json({ success: true, visitId: visit.id, followupId });
  } catch (err) {
    return errorResponse(err);
  }
}
