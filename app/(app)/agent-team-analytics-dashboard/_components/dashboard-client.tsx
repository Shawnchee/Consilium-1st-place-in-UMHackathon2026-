"use client";

/**
 * Live agent execution dashboard. The pipeline visualization primitives
 * (architecture diagram, timeline, Tavily feed, SSE consumer hook, send
 * panel) live in components/agent-team/ and are shared with the live
 * /consult page. This file owns only the dashboard-specific shell:
 * hero, fixture picker, section headers, cost analytics, output preview.
 */

import { useMemo, useState } from "react";
import { Pill } from "@/components/atoms";
import {
  ArchitectureDiagram,
  SendPanel,
  Timeline,
  TavilyFeed,
  useCaptureStream,
  SUB_AGENTS,
  type AgentLanes,
} from "@/components/agent-team";
import { CLINIC } from "@/lib/clinic";
import {
  BORDER_HAIRLINE,
  C,
  FONT_MONO,
  FONT_SERIF,
  SHADOW_CARD,
} from "@/lib/tokens";
import type {
  SessionCaptureResult,
  SubAgentMeta,
  TokenUsage,
} from "@/lib/agents/sub-agents/types";

const PRICING = {
  haiku: { input: 1, output: 5 },
  sonnet: { input: 3, output: 15 },
};

const DEMO_FIXTURES: { id: string; label: string; notes: string; transcript: string }[] = [
  {
    id: "p1",
    label: "Milo — pre-cystotomy workup",
    notes:
      "8yo MN Mini Schnauzer, 9.8kg. 2-wk haematuria + straining. External clinic 1 week ago: amox-clav 250mg BID x7d + Royal Canin Urinary SO — no improvement. QAR. T 38.7, HR 110, RR 28. Mild caudal abdominal discomfort. Abdominal X-ray: 2 large cystoliths nearly filling bladder + multiple uroliths along urethra. Pre-op bloods + urine C/S today. NPO from 22:00. Cystotomy 02 Dec 09:00.",
    transcript:
      "Owner: He's been straining and there's blood in his pee for two weeks. The other clinic gave us antibiotics and that special urinary food a week ago, but it hasn't really helped. He's still eating and drinking, just uncomfortable when he tries to pee.",
  },
  {
    id: "p2",
    label: "Luna — anorexia 48h",
    notes:
      "2-day anorexia, no vomiting, normal water intake. Mild dental tartar grade 2. T 38.9, HR 180, RR 28. Recommended bloods + imaging. Started SC fluids 80 mL Hartmann's, Cerenia 1 mg/kg SC. Bland diet dispensed.",
    transcript:
      "Owner: She just stopped eating Sunday. Still drinks water, still purrs when I pick her up. No vomiting that I've seen. I'm worried because she's normally a chowhound.",
  },
  {
    id: "p3",
    label: "Rex — CCL post-op D3",
    notes:
      "TPLO right stifle day 3. Incision clean, no swelling or discharge. Weight-bearing 30% on RH. Continuing Meloxicam 0.1 mg/kg PO SID + Gabapentin 10 mg/kg PO TID. Owner reports good icing compliance. Recheck D14 for suture removal.",
    transcript:
      "Owner: He's doing the icing twice a day like you said. Sleeping on his side, only stands when I take him out. The cone is annoying him but it's staying on.",
  },
  {
    // Designed to actually trigger Tavily on the prescription agent.
    // Onsior (robenacoxib) is a COX-2-selective veterinary NSAID — NOT in
    // the BILLING_MATRIX, raises species-safety + post-cystotomy duration
    // questions the prescription-agent prompt explicitly considers
    // Tavily-worthy. Use this fixture in the demo to prove the live
    // web-search lights up for non-routine cases.
    id: "p1",
    label: "Milo — Onsior post-op question (Tavily demo)",
    notes:
      "Owner asking about switching Milo from Meloxicam to Onsior (robenacoxib) for post-cystotomy pain — read it's gentler on the kidneys. Confirm current canine safety profile, dose for 9.8kg dog, recommended post-op duration, and any active recalls before tomorrow's surgery.",
    transcript:
      "Owner: My friend's vet uses Onsior for her dog after surgery and says it's better on the kidneys than Meloxicam. Can we use that for Milo instead? I'm worried because he's older and the stones might have already strained things.",
  },
];

export default function AgentDashboardClient() {
  const [fixture, setFixture] = useState<string>(DEMO_FIXTURES[0].id);
  const stream = useCaptureStream();

  async function runPipeline() {
    const f = DEMO_FIXTURES.find((x) => x.id === fixture)!;
    await stream.start({
      patientId: f.id,
      notes: f.notes,
      transcript: f.transcript,
    });
  }

  const totals = useMemo(
    () => computeTotals(stream.lanes, stream.orchestratorMeta),
    [stream.lanes, stream.orchestratorMeta],
  );
  const totalLatencyMs =
    stream.t0 != null && stream.tEnd != null ? stream.tEnd - stream.t0 : null;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px" }}>
      <Hero
        running={stream.running}
        onRun={runPipeline}
        fixture={fixture}
        onFixtureChange={setFixture}
        totalLatencyMs={totalLatencyMs}
        totals={totals}
      />

      {stream.error && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            background: C.redLight,
            border: `1px solid ${C.redBorder}`,
            borderRadius: 10,
            color: C.red,
            fontSize: 13,
          }}
        >
          Pipeline error: {stream.error}
        </div>
      )}

      <Section
        title="Architecture"
        subtitle="Five Haiku sub-agents fan out in parallel, then a Sonnet orchestrator synthesizes for two audiences."
      >
        <ArchitectureDiagram
          lanes={stream.lanes}
          orchestratorRange={stream.orchestratorRange}
        />
      </Section>

      <Section
        title="Live execution timeline"
        subtitle="Gantt view of the parallel fan-out plus the orchestrator step. Clock starts when the first sub-agent fires."
      >
        <Timeline
          lanes={stream.lanes}
          orchestratorRange={stream.orchestratorRange}
          t0={stream.t0}
          tEnd={stream.tEnd}
        />
      </Section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 32,
        }}
      >
        <Section
          title="Tavily query feed"
          subtitle="Live web-search calls from prescription + billing agents."
          inline
        >
          <TavilyFeed events={stream.tavilyEvents} />
        </Section>
        <Section
          title="Tokens & cost"
          subtitle="Per-agent input / output / cache hits. Sonnet costs ~3× Haiku."
          inline
        >
          <CostPanel
            lanes={stream.lanes}
            orchestratorMeta={stream.orchestratorMeta}
            totals={totals}
          />
        </Section>
      </div>

      <Section
        title="Output"
        subtitle="What the doctor sees on the dashboard, and what the owner sees in Telegram."
      >
        <OutputPreview result={stream.result} running={stream.running} />
      </Section>

      <Section
        title="Review & send to owner"
        subtitle="Doctor stays in control — confirm the chat ID, edit the message if needed, then deliver via Telegram. Saves the chat ID to the patient record on success."
      >
        <SendPanel result={stream.result} patientId={fixture} />
      </Section>
    </main>
  );
}

/* ── hero ──────────────────────────────────────────────────────────── */

function Hero({
  running,
  onRun,
  fixture,
  onFixtureChange,
  totalLatencyMs,
  totals,
}: {
  running: boolean;
  onRun: () => void;
  fixture: string;
  onFixtureChange: (v: string) => void;
  totalLatencyMs: number | null;
  totals: ReturnType<typeof computeTotals>;
}) {
  return (
    <div
      style={{
        padding: "36px 0 24px",
        marginBottom: 12,
        borderBottom: `1px solid ${C.borderSoft}`,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 460px)",
        gap: 32,
        alignItems: "end",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: C.muted,
            marginBottom: 10,
          }}
        >
          Architecture · Live
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: FONT_SERIF,
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: -0.8,
            color: C.text,
            lineHeight: 1.06,
          }}
        >
          The agent team behind every consult.
        </h1>
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            color: C.muted,
            maxWidth: 620,
            lineHeight: 1.55,
          }}
        >
          {CLINIC.name} runs a five-agent Haiku 4.5 fan-out for each consult, with
          Tavily wired into prescription and billing for live drug-recall and pricing
          checks. A Sonnet 4.6 orchestrator synthesizes two audiences — the doctor's
          SOAP card, and the friendly Telegram message your owner reads.
        </div>
      </div>

      <div
        style={{
          background: C.card,
          border: BORDER_HAIRLINE,
          borderRadius: 12,
          padding: "18px 20px",
          boxShadow: SHADOW_CARD,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: C.muted,
            }}
          >
            Demo input
          </div>
          <div style={{ flex: 1 }} />
          {totalLatencyMs != null && (
            <Pill tone="green" style={{ fontFamily: FONT_MONO, fontSize: 11 }}>
              {(totalLatencyMs / 1000).toFixed(2)}s · ${totals.costUsd.toFixed(4)}
            </Pill>
          )}
        </div>
        <select
          value={fixture}
          onChange={(e) => onFixtureChange(e.target.value)}
          disabled={running}
          style={{
            background: "#FFFFFF",
            border: BORDER_HAIRLINE,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            color: C.text,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {DEMO_FIXTURES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          onClick={onRun}
          disabled={running}
          style={{
            background: running ? C.borderSoft : C.text,
            color: running ? C.muted : "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: -0.1,
            cursor: running ? "not-allowed" : "pointer",
            transition: "background 140ms ease",
          }}
        >
          {running ? "Running pipeline…" : "Run pipeline"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  inline,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <section style={{ marginTop: inline ? 0 : 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: FONT_SERIF,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: -0.3,
            color: C.text,
          }}
        >
          {title}
        </h2>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

/* ── cost panel ────────────────────────────────────────────────────── */

function CostPanel({
  lanes,
  orchestratorMeta,
  totals,
}: {
  lanes: AgentLanes;
  orchestratorMeta: SubAgentMeta | null;
  totals: ReturnType<typeof computeTotals>;
}) {
  const rows: { label: string; usage?: TokenUsage; model: "haiku" | "sonnet" }[] = [
    ...SUB_AGENTS.map((a) => ({
      label: a.label,
      usage: lanes[a.id].meta?.usage,
      model: "haiku" as const,
    })),
    { label: "Orchestrator", usage: orchestratorMeta?.usage, model: "sonnet" as const },
  ];

  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 12,
        padding: 16,
        minHeight: 180,
        boxShadow: SHADOW_CARD,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 64px 64px 64px 60px",
          gap: 8,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: C.muted,
          paddingBottom: 6,
          borderBottom: BORDER_HAIRLINE,
        }}
      >
        <div>Agent</div>
        <div style={{ textAlign: "right" }}>In</div>
        <div style={{ textAlign: "right" }}>Out</div>
        <div style={{ textAlign: "right" }}>Cache</div>
        <div style={{ textAlign: "right" }}>$</div>
      </div>
      {rows.map((r) => {
        const u =
          r.usage ?? {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          };
        const cost = perCallCost(u, r.model);
        return (
          <div
            key={r.label}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 64px 64px 64px 60px",
              gap: 8,
              padding: "8px 0",
              borderBottom: BORDER_HAIRLINE,
              fontSize: 12.5,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {r.label}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: r.model === "haiku" ? C.brand : C.text,
                  background: r.model === "haiku" ? C.brandLight : "#F1F5F9",
                  border: `1px solid ${r.model === "haiku" ? C.brandBorder : C.border}`,
                  borderRadius: 4,
                  padding: "1px 4px",
                  textTransform: "uppercase",
                }}
              >
                {r.model}
              </span>
            </div>
            <div style={{ textAlign: "right", fontFamily: FONT_MONO }}>{u.inputTokens}</div>
            <div style={{ textAlign: "right", fontFamily: FONT_MONO }}>{u.outputTokens}</div>
            <div
              style={{
                textAlign: "right",
                fontFamily: FONT_MONO,
                color: u.cacheReadTokens > 0 ? C.green : C.hint,
              }}
            >
              {u.cacheReadTokens > 0
                ? `+${u.cacheReadTokens}`
                : u.cacheCreationTokens > 0
                  ? `c${u.cacheCreationTokens}`
                  : "—"}
            </div>
            <div
              style={{
                textAlign: "right",
                fontFamily: FONT_MONO,
                color: cost > 0 ? C.text : C.hint,
              }}
            >
              {cost > 0 ? `$${cost.toFixed(4)}` : "—"}
            </div>
          </div>
        );
      })}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 64px 64px 64px 60px",
          gap: 8,
          padding: "10px 0 0",
          fontSize: 12.5,
          fontWeight: 700,
          alignItems: "center",
        }}
      >
        <div>Total</div>
        <div style={{ textAlign: "right", fontFamily: FONT_MONO }}>{totals.inputTokens}</div>
        <div style={{ textAlign: "right", fontFamily: FONT_MONO }}>{totals.outputTokens}</div>
        <div style={{ textAlign: "right", fontFamily: FONT_MONO, color: C.green }}>
          {totals.cacheReadTokens > 0 ? `+${totals.cacheReadTokens}` : "—"}
        </div>
        <div style={{ textAlign: "right", fontFamily: FONT_MONO }}>${totals.costUsd.toFixed(4)}</div>
      </div>
      {totals.cacheReadTokens > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: C.green }}>
          Prompt cache active — {totals.cacheReadTokens} tokens served at 10% input price.
        </div>
      )}
    </div>
  );
}

/* ── output preview ────────────────────────────────────────────────── */

function OutputPreview({
  result,
  running,
}: {
  result: SessionCaptureResult | null;
  running: boolean;
}) {
  if (!result) {
    return (
      <div
        style={{
          background: C.card,
          border: BORDER_HAIRLINE,
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          color: C.muted,
          fontSize: 13,
          boxShadow: SHADOW_CARD,
        }}
      >
        {running
          ? "Synthesizing summary…"
          : "Run the pipeline to see the doctor SOAP card and Telegram preview here."}
      </div>
    );
  }
  const { summary } = result;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div
        style={{
          background: C.card,
          border: BORDER_HAIRLINE,
          borderRadius: 12,
          padding: 20,
          boxShadow: SHADOW_CARD,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: C.muted,
            marginBottom: 10,
          }}
        >
          Doctor — SOAP card
        </div>
        <SoapBlock soap={summary.doctorSummary.soap} />
        {summary.doctorSummary.flags.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SoapLabel>Flags</SoapLabel>
            {summary.doctorSummary.flags.map((f, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.red, marginTop: 4 }}>
                • {f}
              </div>
            ))}
          </div>
        )}
        {summary.doctorSummary.nextSteps.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SoapLabel>Next steps</SoapLabel>
            {summary.doctorSummary.nextSteps.map((s, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>
                • {s}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          background: C.card,
          border: BORDER_HAIRLINE,
          borderRadius: 12,
          padding: 20,
          boxShadow: SHADOW_CARD,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: C.muted,
            marginBottom: 10,
          }}
        >
          Owner — Telegram preview
        </div>
        <div
          style={{
            background: "#E7F4FE",
            border: `1px solid #BCE0FA`,
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13.5,
            color: C.text,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {summary.ownerMessage.body.replace(/\{clinic\}/g, CLINIC.name)}
        </div>
        {summary.ownerMessage.aftercare.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SoapLabel>Aftercare</SoapLabel>
            {summary.ownerMessage.aftercare.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>
                • {a}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SoapBlock({ soap }: { soap: { S: string; O: string; A: string; P: string } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(["S", "O", "A", "P"] as const).map((k) => (
        <div
          key={k}
          style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 8, alignItems: "start" }}
        >
          <span
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 600,
              color: C.muted,
              fontSize: 13,
            }}
          >
            {k}
          </span>
          <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{soap[k]}</span>
        </div>
      ))}
    </div>
  );
}

function SoapLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: C.muted,
      }}
    >
      {children}
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────────────── */

function perCallCost(u: TokenUsage, model: "haiku" | "sonnet"): number {
  const p = PRICING[model];
  const inCost = (u.inputTokens / 1_000_000) * p.input;
  const outCost = (u.outputTokens / 1_000_000) * p.output;
  const cacheReadCost = (u.cacheReadTokens / 1_000_000) * p.input * 0.1;
  const cacheWriteCost = (u.cacheCreationTokens / 1_000_000) * p.input * 1.25;
  return inCost + outCost + cacheReadCost + cacheWriteCost;
}

function computeTotals(lanes: AgentLanes, orchMeta: SubAgentMeta | null) {
  const usages: { u: TokenUsage; m: "haiku" | "sonnet" }[] = [];
  for (const a of SUB_AGENTS) {
    const u = lanes[a.id].meta?.usage;
    if (u) usages.push({ u, m: "haiku" });
  }
  if (orchMeta?.usage) usages.push({ u: orchMeta.usage, m: "sonnet" });
  return usages.reduce(
    (acc, x) => ({
      inputTokens: acc.inputTokens + x.u.inputTokens,
      outputTokens: acc.outputTokens + x.u.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + x.u.cacheReadTokens,
      cacheCreationTokens: acc.cacheCreationTokens + x.u.cacheCreationTokens,
      costUsd: acc.costUsd + perCallCost(x.u, x.m),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 },
  );
}
