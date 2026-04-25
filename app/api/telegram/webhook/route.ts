/**
 * Telegram webhook route.
 *
 * Dormant in dev (we use polling via scripts/start-bot.ts). Becomes the
 * primary receiver at Phase 8-real: deploy to Vercel, call setWebhook
 * pointing at this URL, and stop the polling process.
 *
 * Request body is a Telegram Update (https://core.telegram.org/bots/api#update).
 * TELEGRAM_WEBHOOK_SECRET is echoed via the `x-telegram-bot-api-secret-token`
 * header — verify on prod.
 *
 * Handles both text-only and photo-with-caption messages. For photos we
 * pick the largest PhotoSize (last entry) and pass the file_id to the
 * handler, which downloads it via the Bot API and persists it to the
 * owner-photos Supabase Storage bucket before invoking Claude vision.
 */

import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { ENV, hasTelegram } from "@/lib/env";
import { handleOwnerMessage } from "@/lib/telegram-handler";
import { sendTelegramMessage } from "@/lib/telegram";

type TgPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

type TgUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: TgPhotoSize[];
    from?: { username?: string };
  };
};

export async function POST(req: Request) {
  try {
    if (!hasTelegram()) throw new ApiError(503, "telegram not configured");

    if (ENV.telegram.webhookSecret) {
      const hdr = req.headers.get("x-telegram-bot-api-secret-token");
      if (hdr !== ENV.telegram.webhookSecret) {
        throw new ApiError(401, "bad secret");
      }
    }

    const body = (await req.json().catch(() => null)) as TgUpdate | null;
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "invalid update");
    }

    const msg = body.message;
    if (!msg) return json({ ok: true, skipped: "non-message" });

    const chatId = String(msg.chat.id);
    const photoFileIds: string[] = [];
    if (msg.photo && msg.photo.length > 0) {
      // Last entry is the largest in Telegram's PhotoSize array.
      photoFileIds.push(msg.photo[msg.photo.length - 1].file_id);
    }
    const text = msg.text ?? msg.caption ?? "";

    if (!text && photoFileIds.length === 0) {
      return json({ ok: true, skipped: "no text or photo" });
    }

    const { reply, decision, followupId, photoUrls } = await handleOwnerMessage(
      chatId,
      { text, photoFileIds: photoFileIds.length > 0 ? photoFileIds : undefined },
    );
    await sendTelegramMessage(chatId, reply);

    console.log(
      `[webhook] chat=${chatId} decision=${decision} followup=${followupId ?? "(unlinked)"}` +
        (photoUrls?.length ? ` photo=${photoUrls[0]}` : ""),
    );
    return json({ ok: true, decision });
  } catch (err) {
    return errorResponse(err);
  }
}
