/**
 * Typed env reader.
 *
 * Every key in `ENV` is present and typed. Missing optional values come back
 * as empty string. Use the `has*` helpers below to branch safely.
 *
 * `MOCK_MODE` is true when explicitly set to "true", OR when any required
 * upstream credential is missing. Routes/components should prefer the
 * `isMockMode()` helper over reading the flag directly so the logic stays
 * in one place.
 */

const read = (k: string): string => process.env[k]?.trim() ?? "";

export const ENV = {
  appUrl: read("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  mockModeRaw: read("MOCK_MODE"),

  zai: {
    apiKey: read("ZAI_API_KEY"),
    model: read("ZAI_MODEL") || "glm-4.6",
    baseUrl: read("ZAI_BASE_URL") || "https://open.bigmodel.cn/api/paas/v4",
  },

  supabase: {
    url: read("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
    dbUrl: read("SUPABASE_DB_URL"),
  },

  telegram: {
    botToken: read("TELEGRAM_BOT_TOKEN"),
    webhookSecret: read("TELEGRAM_WEBHOOK_SECRET"),
  },

  langgraph: {
    serviceUrl: read("LANGGRAPH_SERVICE_URL"),
  },
} as const;

export const hasGLM = () => Boolean(ENV.zai.apiKey);
export const hasSupabase = () =>
  Boolean(ENV.supabase.url && ENV.supabase.anonKey);
export const hasSupabaseAdmin = () =>
  hasSupabase() && Boolean(ENV.supabase.serviceRoleKey);
export const hasTelegram = () => Boolean(ENV.telegram.botToken);

export function isMockMode(): boolean {
  if (ENV.mockModeRaw === "true") return true;
  if (ENV.mockModeRaw === "false") return false;
  return !hasGLM() || !hasSupabase();
}

/**
 * Throws if a required key is missing. Use inside routes/scripts that cannot
 * meaningfully degrade to mock mode.
 */
export function requireEnv(key: string): string {
  const v = read(key);
  if (!v) {
    throw new Error(
      `Missing required env var: ${key}. See .env.local.example.`,
    );
  }
  return v;
}
