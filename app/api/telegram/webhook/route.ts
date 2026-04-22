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
 */

import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { ENV, hasTelegram } from "@/lib/env";
import { handleOwnerMessage } from "@/lib/telegram-handler";
import { sendTelegramMessage } from "@/lib/telegram";

type TgUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
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
    if (!msg?.text) return json({ ok: true, skipped: "non-text" });

    const chatId = String(msg.chat.id);
    const { reply, decision, followupId } = await handleOwnerMessage(
      chatId,
      msg.text,
    );
    await sendTelegramMessage(chatId, reply);

    console.log(
      `[webhook] chat=${chatId} decision=${decision} followup=${followupId ?? "(unlinked)"}`,
    );
    return json({ ok: true, decision });
  } catch (err) {
    return errorResponse(err);
  }
}
