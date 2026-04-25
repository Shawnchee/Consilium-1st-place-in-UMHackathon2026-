/**
 * Long-running Telegram polling process for dev.
 *
 * Run in a second terminal alongside `npm run dev`:
 *
 *   npx tsx scripts/start-bot.ts
 *
 * Polls Telegram for updates, forwards owner messages through the shared
 * handler (lib/telegram-handler.ts), and replies with the triage draft.
 *
 * `/start` replies with the chat id — useful for pasting into
 * `followups.telegram_chat_id` so subsequent messages get linked.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

(async () => {
  const { getBot } = await import("../lib/telegram");
  const { handleOwnerMessage } = await import("../lib/telegram-handler");

  const bot = getBot();
  const me = await bot.api.getMe();
  console.log(
    `[bot] authenticated as @${me.username} (id=${me.id}, name="${me.first_name}")`,
  );

  bot.command("start", async (ctx) => {
    const chatId = String(ctx.chat.id);
    await ctx.reply(
      `Hi! Your chat id is ${chatId}.\n\nAsk PawsClinic KL to link it to your pet's follow-up, then send updates here. Example: "She ate a little but still seems slow."`,
    );
  });

  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // commands handled above
    console.log(`[bot] <- ${chatId}: ${text}`);
    try {
      const { reply, decision, followupId, confidence } =
        await handleOwnerMessage(chatId, { text });
      console.log(
        `[bot] -> decision=${decision} followup=${followupId ?? "(unlinked)"} conf=${
          confidence ?? "-"
        }`,
      );
      await ctx.reply(reply);
    } catch (err) {
      console.error("[bot] error handling message", err);
      await ctx.reply(
        "Sorry — something went wrong. A clinic staff member will follow up shortly.",
      );
    }
  });

  // Photo messages (with optional caption). Telegram sends multiple
  // PhotoSize entries — the last is the largest. Take that one.
  bot.on("message:photo", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const photoSizes = ctx.message.photo;
    const largest = photoSizes[photoSizes.length - 1];
    const caption = ctx.message.caption ?? "";
    console.log(
      `[bot] <- ${chatId}: [photo${caption ? ` + caption: "${caption}"` : ""}]`,
    );
    try {
      const { reply, decision, followupId, confidence, photoUrls } =
        await handleOwnerMessage(chatId, {
          text: caption,
          photoFileIds: [largest.file_id],
        });
      console.log(
        `[bot] -> decision=${decision} followup=${followupId ?? "(unlinked)"} conf=${
          confidence ?? "-"
        } photo=${photoUrls?.[0] ?? "(none)"}`,
      );
      await ctx.reply(reply);
    } catch (err) {
      console.error("[bot] error handling photo", err);
      await ctx.reply(
        "Sorry — couldn't process that photo. A clinic staff member will follow up shortly.",
      );
    }
  });

  bot.catch((err) => {
    console.error("[bot] uncaught", err);
  });

  console.log("[bot] polling — send a message to the bot on Telegram...");
  await bot.start();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
