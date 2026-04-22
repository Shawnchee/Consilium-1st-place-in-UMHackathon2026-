/**
 * Telegram client (real, via grammY).
 *
 * Two callers share one Bot instance:
 *   - `scripts/start-bot.ts` — long-running polling process in dev
 *   - `app/api/telegram/webhook/route.ts` — Vercel prod (Phase 8-real)
 *
 * `sendTelegramMessage` is the send-only helper route handlers can import
 * without pulling in polling machinery.
 */

import { Bot } from "grammy";
import { ENV, hasTelegram } from "./env";

let botSingleton: Bot | null = null;

export function getBot(): Bot {
  if (!hasTelegram()) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN not configured — set it in .env.local.",
    );
  }
  if (!botSingleton) {
    botSingleton = new Bot(ENV.telegram.botToken);
  }
  return botSingleton;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
): Promise<{ ok: true; messageId: number }> {
  const bot = getBot();
  const msg = await bot.api.sendMessage(String(chatId), text);
  return { ok: true, messageId: msg.message_id };
}
