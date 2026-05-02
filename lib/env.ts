/**
 * Typed env reader.
 *
 * Every key in `ENV` is present and typed. Missing optional values come back
 * as empty string. Use the `has*` helpers below to branch safely.
 *
 * `MOCK_MODE` is true when explicitly set to "true", OR when the Anthropic
 * key is missing. Routes/components should prefer the `isMockMode()` helper
 * over reading the flag directly so the logic stays in one place.
 */

const read = (k: string): string => process.env[k]?.trim() ?? "";

export const ENV = {
  appUrl: read("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  mockModeRaw: read("MOCK_MODE"),
  nodeEnv: read("NODE_ENV") || "development",

  // Single-clinic deployment config. Client components read the
  // NEXT_PUBLIC_* mirrors (this same object — Next inlines them at build).
  // Defaults preserve the demo Peng Aun identity so a fresh clone still
  // builds and demos out of the box.
  clinic: {
    id: read("CLINIC_ID") || read("NEXT_PUBLIC_CLINIC_ID") || "pawsclinic_kl",
    name:
      read("NEXT_PUBLIC_CLINIC_NAME") ||
      read("CLINIC_NAME") ||
      "Peng Aun Sg Dua Penang",
    doctor:
      read("NEXT_PUBLIC_CLINIC_DOCTOR") ||
      read("CLINIC_DOCTOR") ||
      "Dr. Amirah",
    phone:
      read("NEXT_PUBLIC_CLINIC_PHONE") ||
      read("CLINIC_PHONE") ||
      "+60 12 345 6789",
  },

  anthropic: {
    apiKey: read("ANTHROPIC_API_KEY"),
    modelBrief: read("ANTHROPIC_MODEL_BRIEF") || "claude-haiku-4-5-20251001",
    modelConsult: read("ANTHROPIC_MODEL_CONSULT") || "claude-sonnet-4-6",
    modelTriage: read("ANTHROPIC_MODEL_TRIAGE") || "claude-sonnet-4-6",
  },

  deepgram: {
    apiKey: read("DEEPGRAM_API_KEY"),
    model: read("DEEPGRAM_MODEL") || "nova-3",
  },

  tavily: {
    apiKey: read("TAVILY_API_KEY"),
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

export const hasLLM = () => Boolean(ENV.anthropic.apiKey);
export const hasDeepgram = () => Boolean(ENV.deepgram.apiKey);
export const hasTavily = () => Boolean(ENV.tavily.apiKey);
export const hasSupabase = () =>
  Boolean(ENV.supabase.url && ENV.supabase.anonKey);
export const hasSupabaseAdmin = () =>
  hasSupabase() && Boolean(ENV.supabase.serviceRoleKey);
export const hasTelegram = () => Boolean(ENV.telegram.botToken);

/** Back-compat alias for the old GLM-era helper. */
export const hasGLM = hasLLM;

export function isMockMode(): boolean {
  if (ENV.mockModeRaw === "true") return true;
  if (ENV.mockModeRaw === "false") return false;
  return !hasLLM();
}

export function isProduction(): boolean {
  return ENV.nodeEnv === "production";
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
