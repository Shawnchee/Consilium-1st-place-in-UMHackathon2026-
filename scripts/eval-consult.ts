/**
 * eval-consult.ts — A/B harness: legacy /api/consult vs multi-agent /api/consult/capture.
 * Hits the running Next.js dev server over HTTP and dumps latency / token / cost
 * metrics into eval-results.csv so we can decide-by-data which pipeline to keep.
 *
 * USAGE:
 *   1) In one terminal:  pnpm dev    (or `npm run dev`)
 *   2) In another:       npx tsx scripts/eval-consult.ts [--base=<url>] [--runs=<n>]
 *
 * NOTE: legacy /api/consult does not surface per-call token usage, so its costUsd
 * is recorded as 0. Multi-agent exposes usage on every sub-agent + orchestrator.
 */
import { writeFile } from "node:fs/promises";

// Pricing reference (USD per 1M tokens) — bake in current Anthropic prices.
const PRICING = {
  haiku: { input: 1, output: 5 },
  sonnet: { input: 3, output: 15 },
  cacheReadMultiplier: 0.1,
  cacheWriteMultiplier: 1.25,
} as const;

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}
const ZERO: Usage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };

function addUsage(a: Usage, b: Usage | undefined): Usage {
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + (b.inputTokens || 0),
    outputTokens: a.outputTokens + (b.outputTokens || 0),
    cacheCreationTokens: a.cacheCreationTokens + (b.cacheCreationTokens || 0),
    cacheReadTokens: a.cacheReadTokens + (b.cacheReadTokens || 0),
  };
}
function costFor(u: Usage, model: "haiku" | "sonnet"): number {
  const p = PRICING[model];
  const per = (rate: number) => rate / 1_000_000;
  return (
    u.inputTokens * per(p.input) +
    u.outputTokens * per(p.output) +
    u.cacheReadTokens * per(p.input) * PRICING.cacheReadMultiplier +
    u.cacheCreationTokens * per(p.input) * PRICING.cacheWriteMultiplier
  );
}

interface Fixture {
  id: string;
  patientId: string;
  notes: string;
  transcript?: string;
  diagnosisHint?: string;
}
const FIXTURES: Fixture[] = [
  {
    id: "milo-ear-recheck",
    patientId: "p1",
    notes:
      "Right ear inflamed and red on otoscopic exam, smelly brown discharge. Owner reports head shaking returned 4 days ago. Prescribing Otomax 4 drops BID for 7 days, recheck in 2 weeks. Vaccine still overdue, owner agreed today.",
    transcript:
      "Yeah he started shaking his head again last weekend, Tuesday I think. I noticed the gunk again so I brought him in. The dental thing — uh, I'd rather hold off on that for now if it's okay.",
    diagnosisHint: "Recurrent otitis externa (right)",
  },
  {
    id: "luna-anorexia",
    patientId: "p2",
    notes:
      "First visit. Cat not eating for 2 days per owner, drinking water normally. Mild dehydration on exam (skin tent 1s), BCS 4/9, weight 3.8kg. Mild gingivitis bilaterally, no obvious oral mass. Recommend baseline bloods (CBC + chem), FIV/FeLV snap, and SC fluids today. Mirtazapine 1.88mg transdermal q72h if no improvement.",
  },
  {
    id: "rex-postop-day3",
    patientId: "p3",
    notes:
      "Post-op Day 3 TPLO right stifle. Incision dry, no swelling or discharge, sutures intact. Toe-touching weight bearing on affected limb — appropriate for stage. Owner icing 3x/day as instructed. Continue Meloxicam 0.1mg/kg SID and Gabapentin 10mg/kg BID for 4 more days. Strict rest, suture removal Day 14, radiograph at 6 weeks.",
  },
];

function flag(name: string, fallback: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
}
const BASE = flag("base", "http://localhost:3000").replace(/\/$/, "");
const RUNS = Math.max(1, parseInt(flag("runs", "1"), 10) || 1);

async function postJson(path: string, body: unknown): Promise<unknown> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`POST ${path} -> ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

interface Row {
  fixture: string;
  pipeline: "legacy" | "multi-agent";
  run: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  source: string;
  outputShape: string;
}

async function runLegacy(fx: Fixture, run: number): Promise<Row> {
  const start = Date.now();
  const res = (await postJson("/api/consult", { patientId: fx.patientId, notes: fx.notes })) as {
    output?: unknown;
    source?: string;
  };
  return {
    fixture: fx.id, pipeline: "legacy", run, latencyMs: Date.now() - start, ...ZERO, costUsd: 0,
    source: res.source ?? "unknown",
    outputShape: res.output ? Object.keys(res.output as object).sort().join("|") : "(empty)",
  };
}

async function runMulti(fx: Fixture, run: number): Promise<Row> {
  const start = Date.now();
  const res = (await postJson("/api/consult/capture", {
    patientId: fx.patientId, notes: fx.notes, transcript: fx.transcript,
    diagnosisHint: fx.diagnosisHint, sendTelegram: false,
  })) as {
    session?: Record<string, { meta?: { usage?: Usage } } | undefined>;
    summary?: unknown; orchestratorMeta?: { usage?: Usage }; meta?: { source?: string };
  };
  const latencyMs = Date.now() - start;
  let haiku: Usage = { ...ZERO };
  for (const k of Object.keys(res.session ?? {})) haiku = addUsage(haiku, res.session?.[k]?.meta?.usage);
  const sonnet: Usage = res.orchestratorMeta?.usage ? { ...ZERO, ...res.orchestratorMeta.usage } : { ...ZERO };
  const total = addUsage(haiku, sonnet);
  return {
    fixture: fx.id, pipeline: "multi-agent", run, latencyMs,
    inputTokens: total.inputTokens, outputTokens: total.outputTokens,
    cacheReadTokens: total.cacheReadTokens, cacheCreationTokens: total.cacheCreationTokens,
    costUsd: costFor(haiku, "haiku") + costFor(sonnet, "sonnet"),
    source: res.meta?.source ?? "unknown",
    outputShape: res.summary ? Object.keys(res.summary as object).sort().join("|") : "(empty)",
  };
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function main() {
  console.log(`[eval] base=${BASE} runs=${RUNS} fixtures=${FIXTURES.length}`);
  const rows: Row[] = [];
  for (const fx of FIXTURES) {
    for (let run = 1; run <= RUNS; run++) {
      for (const pipeline of ["legacy", "multi-agent"] as const) {
        const fn = pipeline === "legacy" ? runLegacy : runMulti;
        try {
          const row = await fn(fx, run);
          rows.push(row);
          console.log(
            `[eval] ${row.fixture.padEnd(22)} ${row.pipeline.padEnd(11)} run=${row.run}` +
              `  ${row.latencyMs}ms  $${row.costUsd.toFixed(5)}  src=${row.source}  shape=${row.outputShape}`,
          );
        } catch (err) {
          console.error(`[eval] FAIL ${fx.id} ${pipeline} run=${run}:`, err);
        }
      }
    }
  }

  console.table(
    rows.map((r) => ({
      fixture: r.fixture, pipeline: r.pipeline, run: r.run, latencyMs: r.latencyMs,
      inTok: r.inputTokens, outTok: r.outputTokens, cacheR: r.cacheReadTokens,
      cacheW: r.cacheCreationTokens, cost$: r.costUsd.toFixed(5), source: r.source,
    })),
  );

  const header =
    "fixture,pipeline,run,latencyMs,inputTokens,outputTokens,cacheReadTokens,cacheCreationTokens,costUsd,source";
  const csv = [
    header,
    ...rows.map((r) =>
      [r.fixture, r.pipeline, r.run, r.latencyMs, r.inputTokens, r.outputTokens,
        r.cacheReadTokens, r.cacheCreationTokens, r.costUsd.toFixed(6), r.source].join(","),
    ),
  ].join("\n");
  await writeFile("eval-results.csv", csv, "utf8");
  console.log(`[eval] wrote eval-results.csv (${rows.length} rows)`);

  const legacy = rows.filter((r) => r.pipeline === "legacy");
  const multi = rows.filter((r) => r.pipeline === "multi-agent");
  const lp50 = median(legacy.map((r) => r.latencyMs));
  const mp50 = median(multi.map((r) => r.latencyMs));
  const lc = mean(legacy.map((r) => r.costUsd));
  const mc = mean(multi.map((r) => r.costUsd));
  console.log("\n[eval] SUMMARY");
  console.log(`  legacy      : p50 ${lp50.toFixed(0)}ms   mean cost $${lc.toFixed(5)}   n=${legacy.length}`);
  console.log(`  multi-agent : p50 ${mp50.toFixed(0)}ms   mean cost $${mc.toFixed(5)}   n=${multi.length}`);
  const costR = lc > 0 ? mc / lc : Infinity;
  const latR = lp50 > 0 ? mp50 / lp50 : Infinity;
  const costFmt = Number.isFinite(costR) ? `${costR.toFixed(2)}x` : "n/a (legacy cost unmeasured)";
  const latFmt = Number.isFinite(latR) ? `${latR.toFixed(2)}x` : "n/a";
  console.log(`[eval] verdict: multi-agent: ${costFmt} cost, ${latFmt} p50 latency vs legacy`);
}

main().catch((err) => {
  console.error("[eval] fatal:", err);
  process.exit(1);
});
