/**
 * Smoke test for the Tavily executor.
 *
 * Run:  npx tsx scripts/test-tavily.ts
 *
 * Hits the live Tavily API (uses TAVILY_API_KEY from .env.local). Verifies
 * the request shape and trims/normalises the result the way the LLM tool
 * loop will see it.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  // Dynamic import — must be after loadEnvConfig so env vars are populated
  // before lib/env.ts evaluates its top-level constants.
  const { executeTavily } = await import("../lib/tools/tavily");
  const r = await executeTavily({
    query: "meloxicam canine drug recall 2026",
    reason: "smoke test from scripts/test-tavily.ts",
  });
  console.log("cached:", r.cached);
  console.log("answer:", r.answer?.slice(0, 240) ?? "(no answer)");
  console.log("results:", r.results.length);
  for (const x of r.results.slice(0, 3)) {
    console.log("  •", x.title);
    console.log("    ", x.url);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
