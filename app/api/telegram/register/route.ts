import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { ENV, hasTelegram } from "@/lib/env";

/**
 * Convenience route to register the Telegram webhook.
 * 
 * VISIT THIS URL ONCE AFTER DEPLOYING:
 * https://consilium-tau.vercel.app/api/telegram/register
 */
export async function GET(req: Request) {
  try {
    if (!hasTelegram()) {
      throw new ApiError(500, "TELEGRAM_BOT_TOKEN is missing");
    }

    const { searchParams } = new URL(req.url);
    
    // Fallback to the request's origin if NEXT_PUBLIC_APP_URL is not set or is localhost
    let baseUrl = ENV.appUrl;
    if (baseUrl.includes("localhost")) {
      const url = new URL(req.url);
      baseUrl = `${url.protocol}//${url.host}`;
    }

    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;
    const secret = ENV.telegram.webhookSecret;

    if (!secret) {
      throw new ApiError(400, "TELEGRAM_WEBHOOK_SECRET is not set in Vercel. Please add it first.");
    }

    console.log(`[telegram-register] Registering webhook: ${webhookUrl}`);

    const registerUrl = new URL(`https://api.telegram.org/bot${ENV.telegram.botToken}/setWebhook`);
    registerUrl.searchParams.set("url", webhookUrl);
    registerUrl.searchParams.set("secret_token", secret);

    const resp = await fetch(registerUrl.toString());
    const result = await resp.json();

    return json({
      ok: result.ok,
      message: result.description || (result.ok ? "Webhook registered successfully!" : "Failed to register webhook"),
      config: {
        baseUrl,
        webhookUrl,
        hasSecret: !!secret
      },
      telegramResponse: result
    });
  } catch (err) {
    return errorResponse(err);
  }
}
