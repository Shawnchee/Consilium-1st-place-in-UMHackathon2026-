/**
 * Tavily web-search tool — exposed to Claude as a function tool. The model
 * decides when to call it (typically: drug-recall checks, unfamiliar
 * protocols, regional outbreak intel). Results are cached in Supabase for
 * 7 days when admin credentials are present, otherwise the call is just
 * executed live each time.
 */

import { ENV, hasSupabaseAdmin, hasTavily } from "../env";
import { getSupabaseServer } from "../supabase";

const TAVILY_URL = "https://api.tavily.com/search";
const CACHE_TTL_DAYS = 7;

export interface TavilyArgs {
  query: string;
  reason: string;
}

export interface TavilyResult {
  query: string;
  cached: boolean;
  results: { title: string; url: string; content: string; score?: number }[];
  answer?: string;
}

export const tavilyTool = {
  name: "tavily_search",
  description:
    "Search the web for current veterinary clinical guidance, drug recalls, treatment protocol updates, or regional outbreak intel. " +
    "Use ONLY when uncertain about a recent change or unfamiliar drug/condition. " +
    "DO NOT use for routine items in the billing matrix or for standard SOAP structuring. " +
    "Maximum one search per request — make it count.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          "Specific clinical question. Include species + drug or condition + 'vet' + recent year (e.g. 'Meloxicam canine recall 2026', 'parvo outbreak Kuala Lumpur 2026').",
      },
      reason: {
        type: "string",
        description:
          "Brief justification (will be logged for audit). One sentence.",
      },
    },
    required: ["query", "reason"],
  },
};

function normaliseQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

async function readCache(query: string): Promise<TavilyResult | null> {
  if (!hasSupabaseAdmin()) return null;
  try {
    const db = getSupabaseServer();
    const cutoff = new Date(
      Date.now() - CACHE_TTL_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const { data } = await db
      .from("tavily_cache")
      .select("payload, created_at")
      .eq("query_norm", normaliseQuery(query))
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ payload: TavilyResult; created_at: string }>();
    if (data?.payload) return { ...data.payload, cached: true };
  } catch {
    // Cache miss is non-fatal — table may not exist yet.
  }
  return null;
}

async function writeCache(query: string, payload: TavilyResult): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  try {
    const db = getSupabaseServer();
    await db.from("tavily_cache").insert({
      query_norm: normaliseQuery(query),
      query_raw: query,
      payload,
    });
  } catch {
    // Best-effort. Cache table missing? Ignore.
  }
}

export async function executeTavily(args: TavilyArgs): Promise<TavilyResult> {
  if (!hasTavily()) {
    return {
      query: args.query,
      cached: false,
      results: [],
      answer:
        "Tavily search is not configured on this server. Proceed without web context.",
    };
  }

  const cached = await readCache(args.query);
  if (cached) return cached;

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.tavily.apiKey}`,
    },
    body: JSON.stringify({
      query: args.query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
      topic: "general",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      query: args.query,
      cached: false,
      results: [],
      answer: `Tavily search failed (${res.status}): ${text.slice(0, 200)}. Proceed without web context.`,
    };
  }

  const json = (await res.json()) as {
    answer?: string;
    results?: { title: string; url: string; content: string; score?: number }[];
  };

  const out: TavilyResult = {
    query: args.query,
    cached: false,
    answer: json.answer,
    results: (json.results ?? []).slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content?.slice(0, 800) ?? "",
      score: r.score,
    })),
  };

  await writeCache(args.query, out);
  return out;
}
