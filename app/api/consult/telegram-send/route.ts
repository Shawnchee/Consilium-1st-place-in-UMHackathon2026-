/**
 * POST /api/consult/telegram-send
 *
 * Doctor-reviewed delivery of the orchestrator's owner message. The flow:
 *   1. Doctor runs the multi-agent capture (sendTelegram defaults to
 *      false now — capture only generates the draft, never delivers).
 *   2. Doctor reviews the draft body + aftercare in the UI, edits if
 *      desired, enters or confirms the owner's Telegram chat ID.
 *   3. Doctor clicks "Send" — that hits this endpoint.
 *
 * Side effects (in order):
 *   a. Validate input shape + chat ID format.
 *   b. Telegram send via grammY.
 *   c. On success, best-effort upsert patients.owner_telegram so the
 *      doctor never has to re-enter for this patient (option A —
 *      always save). DB failure does not roll back the send; the
 *      message is already delivered.
 */

import { NextResponse } from "next/server";
import {
  ApiError,
  parseTelegramSendRequest,
  type TelegramSendResponse,
} from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { hasSupabaseAdmin, hasTelegram } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    if (!hasTelegram()) {
      return NextResponse.json(
        { error: "telegram not configured (TELEGRAM_BOT_TOKEN missing)" },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const {
      chatId,
      body: messageBody,
      aftercare,
      patientId,
      patientName,
      visitId,
      status: reqStatus,
      recommendedAction,
    } = parseTelegramSendRequest(body);

    const message = formatMessage(messageBody, aftercare ?? []);

    let messageId: number;
    try {
      const r = await sendTelegramMessage(chatId, message);
      messageId = r.messageId;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `telegram send failed: ${detail}` },
        { status: 502 },
      );
    }

    const chatIdSaved = await saveChatIdToPatient({
      patientId,
      patientName,
      chatId,
      visitId,
      status: reqStatus,
      recommendedAction,
      draftResponse: message,
    });

    return json<TelegramSendResponse>({
      ok: true,
      messageId,
      chatIdSaved,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function formatMessage(body: string, aftercare: string[]): string {
  if (aftercare.length === 0) return body;
  const lines = aftercare.map((a) => `• ${a}`).join("\n");
  return `${body}\n\nAftercare:\n${lines}`;
}

/**
 * Best-effort write of owner_telegram onto the patient row. Returns true
 * when the row was updated, false when the DB is unavailable, write
 * failed, row didn't exist (e.g. mock patient), or owner_telegram was
 * already set on the patient. Never throws — the Telegram message has
 * already been delivered, so a save failure must not surface as an
 * error to the doctor.
 *
 * SECURITY: the update is gated to rows where owner_telegram IS NULL
 * (option A — first-write-wins, no overwrite). Without this gate, an
 * attacker who guesses a patient UUID could send a successful Telegram
 * message to themselves and silently overwrite the real owner's chat
 * ID — every subsequent owner-facing message would then go to the
 * attacker. With this gate, the worst an attacker can do is claim a
 * patient that has no chat ID on file yet; the doctor sees
 * chatIdSaved=true even though they didn't expect a save. Real fix is
 * auth in front of the route; this is the cheapest mitigation absent
 * that.
 */
async function saveChatIdToPatient(req: {
  patientId: string;
  patientName: string;
  chatId: string;
  visitId?: string;
  status?: string;
  recommendedAction?: string;
  draftResponse?: string;
}): Promise<boolean> {
  if (!hasSupabaseAdmin()) return false;
  try {
    const db = getSupabaseServer();
    
    // 1. Update the patient record (long-term memory)
    const { data: patientData, error: patientError } = await db
      .from("patients")
      .update({ owner_telegram: req.chatId })
      .eq("id", req.patientId)
      .select("id")
      .maybeSingle<{ id: string }>();
    
    if (patientError) {
      console.error("[telegram-send] failed to update patient", patientError);
    }

    // 2. Create or Update the follow-up record for this visit
    if (req.visitId) {
      const { data: existingFup } = await db
        .from("followups")
        .select("id")
        .eq("visit_id", req.visitId)
        .maybeSingle();

      const fupData = {
        visit_id: req.visitId,
        telegram_chat_id: req.chatId,
        status: req.status || "monitor",
        recommended_action: req.recommendedAction || "Monitor for 48h",
        draft_response: req.draftResponse,
        sent_at: new Date().toISOString(),
      };

      if (existingFup) {
        const { error: fupError } = await db
          .from("followups")
          .update(fupData)
          .eq("id", existingFup.id);
        if (fupError) console.error("[telegram-send] failed to update followup", fupError);
      } else {
        const { error: fupError } = await db
          .from("followups")
          .insert(fupData);
        if (fupError) console.error("[telegram-send] failed to insert followup", fupError);
      }
    }

    return Boolean(patientData?.id);
  } catch (err) {
    console.error(
      "[telegram-send] unexpected save error:",
      err instanceof Error ? err.message : "unknown error",
    );
    return false;
  }
}
