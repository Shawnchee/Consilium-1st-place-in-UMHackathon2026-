/**
 * Telegram client (real, via grammY).
 *
 * Two callers share one Bot instance:
 *   - `scripts/start-bot.ts` — long-running polling process in dev
 *   - `app/api/telegram/webhook/route.ts` — Vercel prod (Phase 8-real)
 *
 * `sendTelegramMessage` is the send-only helper route handlers can import
 * without pulling in polling machinery.
 *
 * `fetchTelegramPhotoAsImage` downloads an owner-sent photo by file_id,
 * persists it to the owner-photos Supabase Storage bucket, and returns a
 * Claude-ready image input (URL or inline base64).
 */

import { Bot } from "grammy";
import { ENV, hasTelegram } from "./env";
import { uploadPhotoBytes } from "./storage";
import type { LLMImage } from "./llm";

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

export async function fetchTelegramPhotoAsImage(
  fileId: string,
): Promise<LLMImage | null> {
  const bot = getBot();
  try {
    const file = await bot.api.getFile(fileId);
    if (!file.file_path) return null;
    const url = `https://api.telegram.org/file/bot${ENV.telegram.botToken}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const ext = file.file_path.split(".").pop()?.toLowerCase() ?? "jpg";
    const mediaType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return await uploadPhotoBytes("owner-photos", bytes, mediaType);
  } catch (err) {
    console.warn("[telegram] photo fetch failed", err);
    return null;
  }
}
