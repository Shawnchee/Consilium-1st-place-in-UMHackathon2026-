"use client";

import { CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";
import { Button, Card, Icon } from "@/components/atoms";
import { PageHeader } from "@/components/app-shell/page-header";
import { Skeleton } from "@/components/app-shell/skeleton";
import { ErrorBanner } from "@/components/app-shell/error-banner";
import { api } from "@/lib/api";
import type { CorrectionRow, DiagnosisRow } from "@/lib/types";
import {
  BORDER_HAIRLINE,
  C,
  FONT_MONO,
  FONT_SANS,
  FONT_SERIF,
  RADIUS,
} from "@/lib/tokens";

/* ------------------------------------------------------------------
   Shared — editorial section wrapper with FadeUp on mount,
   serif headline, mono/sans metadata. No shadow. Hairline border.
   ------------------------------------------------------------------ */
function Section({
  kicker,
  title,
  caption,
  right,
  delay = 0,
  children,
  style,
}: {
  kicker: string;
  title: string;
  caption?: ReactNode;
  right?: ReactNode;
  delay?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        animation: `fadeUp 520ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms both`,
        marginTop: 32,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 18,
          paddingBottom: 12,
          marginBottom: 16,
          borderBottom: BORDER_HAIRLINE,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.hint,
              marginBottom: 6,
            }}
          >
            {kicker}
          </div>
          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.4,
              color: C.text,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {title}
          </h3>
          {caption && (
            <div
              style={{
                fontSize: 13,
                color: C.muted,
                marginTop: 6,
                maxWidth: 640,
                lineHeight: 1.55,
              }}
            >
              {caption}
            </div>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------
   Sparkline — pure SVG polyline, 1px hairline stroke, no fill.
   Points normalized to viewBox. Deterministic (no randomness).
   ------------------------------------------------------------------ */
function Sparkline({
  points,
  color = C.text,
  height = 30,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  const w = 140;
  const h = height;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------
   KPI card — muted sans label, giant serif number, mono delta,
   sparkline under. No shadow gradient.
   ------------------------------------------------------------------ */
function KPI({
  label,
  value,
  delta,
  deltaTone = "muted",
  spark,
  sparkColor = C.text,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone?: "green" | "red" | "amber" | "muted";
  spark: number[];
  sparkColor?: string;
}) {
  const toneColor =
    deltaTone === "green"
      ? C.greenDark
      : deltaTone === "red"
      ? C.red
      : deltaTone === "amber"
      ? C.amber
      : C.muted;
  return (
    <Card style={{ padding: "20px 22px 18px" }}>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          color: C.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 46,
          fontWeight: 600,
          letterSpacing: -1.4,
          color: C.text,
          lineHeight: 1.05,
          marginTop: 10,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11.5,
          color: toneColor,
          marginTop: 4,
          letterSpacing: 0.2,
        }}
      >
        {delta}
      </div>
      <div style={{ marginTop: 14 }}>
        <Sparkline points={spark} color={sparkColor} height={28} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Animated bar — scaleX mount transform, capped within 1s.
   Only transform / opacity animated.
   ------------------------------------------------------------------ */
function useMounted(delayMs = 120) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return mounted;
}

/* ------------------------------------------------------------------
   Section 2 — Triage decision distribution (stacked horizontal).
   Solid flat tones. Hairline border. Animated scaleX on mount.
   ------------------------------------------------------------------ */
function TriageDistribution() {
  const mounted = useMounted(160);
  const segments = [
    { key: "ALL_CLEAR", pct: 64, color: C.green, label: "All clear" },
    { key: "MONITOR", pct: 24, color: C.amber, label: "Monitor" },
    { key: "ESCALATE", pct: 12, color: C.red, label: "Escalate" },
  ];
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 42,
          border: BORDER_HAIRLINE,
          borderRadius: RADIUS.sm,
          overflow: "hidden",
          background: "#FFFFFF",
        }}
      >
        {segments.map((s, i) => (
          <div
            key={s.key}
            style={{
              width: `${s.pct}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "0 12px",
              background: s.color,
              color: "#FFFFFF",
              borderRight:
                i < segments.length - 1
                  ? "1px solid rgba(255,255,255,0.35)"
                  : "none",
              transformOrigin: "left center",
              transform: mounted ? "scaleX(1)" : "scaleX(0)",
              transition: `transform 780ms cubic-bezier(0.2,0.8,0.2,1) ${
                i * 120
              }ms`,
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.3,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {s.pct}%
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          gap: 22,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: C.ink,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: s.color,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 600 }}>{s.label}</span>
            <span
              style={{
                fontFamily: FONT_MONO,
                color: C.muted,
                fontSize: 12,
              }}
            >
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Section 3 — Validation table. Hairline borders only.
   Ambiguous row has a left-accent bar (1px wide, brand color).
   Pull-quote: 94% vs 63% treated as headline.
   ------------------------------------------------------------------ */
function ValidationTable() {
  const rows: {
    label: string;
    glm: string;
    baseline: string;
    highlight?: boolean;
  }[] = [
    { label: "Normal (20)", glm: "95%", baseline: "90%" },
    { label: "Ambiguous (15)", glm: "87%", baseline: "33%", highlight: true },
    { label: "Red flag (15)", glm: "100%", baseline: "67%" },
    { label: "Overall (50)", glm: "94%", baseline: "63%" },
  ];
  const header: CSSProperties = {
    fontFamily: FONT_SANS,
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: C.muted,
    fontWeight: 700,
    padding: "10px 14px",
    textAlign: "right",
    borderBottom: BORDER_HAIRLINE,
  };
  const cellBase: CSSProperties = {
    padding: "14px 14px",
    fontFamily: FONT_MONO,
    fontSize: 14,
    textAlign: "right",
    color: C.text,
    borderBottom: BORDER_HAIRLINE,
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr",
        border: BORDER_HAIRLINE,
        borderRadius: RADIUS.lg,
        overflow: "hidden",
        background: "#FFFFFF",
      }}
    >
      <div style={{ ...header, textAlign: "left" }}>Scenario</div>
      <div style={{ ...header }}>Consilium GLM</div>
      <div style={{ ...header }}>Keyword baseline</div>
      {rows.map((r, i) => {
        const isLast = i === rows.length - 1;
        const base: CSSProperties = {
          ...cellBase,
          borderBottom: isLast ? "none" : BORDER_HAIRLINE,
          background: isLast ? "#FBFAF6" : "transparent",
        };
        return (
          <div key={r.label} style={{ display: "contents" }}>
            <div
              style={{
                ...base,
                textAlign: "left",
                fontFamily: FONT_SANS,
                fontWeight: isLast ? 700 : 500,
                color: C.text,
                position: "relative",
                paddingLeft: r.highlight ? 18 : 14,
              }}
            >
              {r.highlight && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    background: C.brand,
                  }}
                />
              )}
              {r.label}
            </div>
            <div
              style={{
                ...base,
                color: r.highlight ? C.greenDark : C.text,
                fontWeight: isLast || r.highlight ? 700 : 500,
              }}
            >
              {r.glm}
            </div>
            <div
              style={{
                ...base,
                color: r.highlight ? C.red : C.muted,
                fontWeight: isLast || r.highlight ? 700 : 500,
              }}
            >
              {r.baseline}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Section 4 — Top diagnoses (10 bars). Flat solid neutral tone.
   Hairline baseline under each bar.
   ------------------------------------------------------------------ */
const DIAGNOSIS_EXTRAS: DiagnosisRow[] = [
  { label: "Urinary tract infection", count: 9 },
  { label: "Conjunctivitis", count: 8 },
  { label: "Obesity / weight mgmt", count: 7 },
  { label: "Parvovirus screen", count: 5 },
  { label: "Ingested foreign body", count: 4 },
];

function TopDiagnosesBars({ rows }: { rows: DiagnosisRow[] }) {
  const mounted = useMounted(180);
  const max = Math.max(1, ...rows.map((d) => d.count));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((d, i) => {
        const ratio = d.count / max;
        const stagger = Math.min(i * 60, 600);
        return (
          <div
            key={d.label}
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr 44px",
              alignItems: "center",
              gap: 14,
              paddingBottom: 6,
              borderBottom: BORDER_HAIRLINE,
            }}
          >
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 13,
                color: C.ink,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                height: 14,
                background: "transparent",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${ratio * 100}%`,
                  background: "#3F3B33",
                  transformOrigin: "left center",
                  transform: mounted ? "scaleX(1)" : "scaleX(0)",
                  transition: `transform 820ms cubic-bezier(0.2,0.8,0.2,1) ${stagger}ms`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                textAlign: "right",
              }}
            >
              {d.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Section 5 — Corrections log. Hairline rows, mono date,
   realistic mock data from lib + two extras to reach 6+ rows.
   ------------------------------------------------------------------ */
type CorrRow = {
  date: string;
  feature: string;
  glm: string;
  fix: string;
  reason: string;
};

const CORR_EXTRAS: CorrRow[] = [
  {
    date: "10 Apr",
    feature: "Billing",
    glm: "Radiograph × 1",
    fix: "Radiograph × 2 views",
    reason: "Both lateral + CC shot taken",
  },
  {
    date: "08 Apr",
    feature: "Triage",
    glm: "ALL_CLEAR",
    fix: "MONITOR",
    reason: "Owner downplayed vomiting frequency",
  },
  {
    date: "05 Apr",
    feature: "Prescription",
    glm: "Amoxicillin 7d",
    fix: "Amoxi-clav 10d",
    reason: "Resistant strain suspected",
  },
];

function correctionsToRows(log: CorrectionRow[]): CorrRow[] {
  return log.map((r) => ({
    date: r.date,
    feature: r.feature,
    glm: r.glm,
    fix: r.fix.split(" — ")[0] ?? r.fix,
    reason: r.fix.split(" — ")[1] ?? r.who,
  }));
}

function CorrectionsTable({ rows }: { rows: CorrRow[] }) {
  const cols: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "90px 130px 1.3fr 1.3fr 1.2fr",
    gap: 18,
    padding: "14px 20px",
    alignItems: "center",
  };
  return (
    <div
      style={{
        border: BORDER_HAIRLINE,
        borderRadius: RADIUS.lg,
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...cols,
          borderBottom: BORDER_HAIRLINE,
          background: "#FBFAF6",
        }}
      >
        {["Date", "Feature", "GLM output", "Doctor correction", "Reason"].map(
          (h) => (
            <div
              key={h}
              style={{
                fontFamily: FONT_SANS,
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: 1.4,
                color: C.muted,
                fontWeight: 700,
              }}
            >
              {h}
            </div>
          )
        )}
      </div>
      {rows.map((r, i) => {
        const toneColor =
          r.feature === "Triage"
            ? C.red
            : r.feature === "Billing"
            ? C.amber
            : C.ink;
        return (
          <div
            key={i}
            style={{
              ...cols,
              borderBottom:
                i < rows.length - 1 ? BORDER_HAIRLINE : "none",
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12.5,
                color: C.muted,
              }}
            >
              {r.date}
            </div>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 12.5,
                fontWeight: 600,
                color: toneColor,
                letterSpacing: 0.2,
              }}
            >
              {r.feature}
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.muted,
                textDecoration: "line-through",
                fontFamily: FONT_MONO,
              }}
            >
              {r.glm}
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.text,
                fontWeight: 600,
                fontFamily: FONT_MONO,
              }}
            >
              {r.fix}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: C.ink,
                lineHeight: 1.45,
              }}
            >
              {r.reason}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Section 6 — Follow-up funnel. 4 steps stacked hairline blocks,
   mono percentages. Not a curved funnel.
   ------------------------------------------------------------------ */
function FollowUpFunnel() {
  const mounted = useMounted(180);
  const steps = [
    {
      label: "Messages sent",
      sub: "24–48h after visit",
      pct: 100,
      count: "412",
      tone: C.ink,
    },
    {
      label: "Owner replied",
      sub: "Natural language",
      pct: 78,
      count: "321",
      tone: C.ink,
    },
    {
      label: "Auto-resolved (ALL_CLEAR)",
      sub: "GLM confidence >85%",
      pct: 64,
      count: "205",
      tone: C.green,
    },
    {
      label: "Monitor",
      sub: "One-tap doctor confirm",
      pct: 24,
      count: "77",
      tone: C.amber,
    },
    {
      label: "Escalate",
      sub: "Full escalation card",
      pct: 12,
      count: "39",
      tone: C.red,
    },
  ];
  return (
    <div
      style={{
        border: BORDER_HAIRLINE,
        borderRadius: RADIUS.lg,
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const stagger = i * 100;
        return (
          <div
            key={s.label}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 2fr 70px 70px",
              alignItems: "center",
              gap: 18,
              padding: "16px 20px",
              borderBottom: isLast ? "none" : BORDER_HAIRLINE,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: C.text,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: C.hint,
                  marginTop: 2,
                }}
              >
                {s.sub}
              </div>
            </div>
            <div
              style={{
                height: 10,
                border: BORDER_HAIRLINE,
                borderRadius: 2,
                overflow: "hidden",
                background: "#FFFFFF",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${s.pct}%`,
                  background: s.tone,
                  transformOrigin: "left center",
                  transform: mounted ? "scaleX(1)" : "scaleX(0)",
                  transition: `transform 780ms cubic-bezier(0.2,0.8,0.2,1) ${stagger}ms`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                color: s.tone,
                fontWeight: 700,
                textAlign: "right",
              }}
            >
              {s.pct}%
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12.5,
                color: C.muted,
                textAlign: "right",
              }}
            >
              {s.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Page
   ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  const [diagnoses, setDiagnoses] = useState<DiagnosisRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = () => {
    setLoading(true);
    setError(null);
    api
      .getAnalytics()
      .then((r) => {
        setDiagnoses(r.diagnoses);
        setCorrections(r.corrections);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const topDiagnoses = useMemo(
    () => [...diagnoses, ...DIAGNOSIS_EXTRAS],
    [diagnoses],
  );
  const corrRows = useMemo(
    () => [...correctionsToRows(corrections), ...CORR_EXTRAS],
    [corrections],
  );

  // Deterministic sparkline data — last 12 weeks
  const sparkTime = [28, 31, 30, 33, 35, 34, 38, 40, 41, 43, 45, 47];
  const sparkBill = [
    5800, 6200, 6600, 6400, 7200, 7500, 7900, 8300, 8400, 8800, 9000, 9200,
  ];
  const sparkComp = [1, 0, 1, 2, 1, 2, 2, 1, 2, 3, 2, 3];
  const sparkResp = [62, 64, 66, 68, 70, 71, 70, 73, 75, 74, 76, 78];

  return (
    <div
      style={{
        padding: "0 32px 120px",
        maxWidth: 1480,
        margin: "0 auto",
      }}
    >
      <PageHeader
        eyebrow="Analytics · April 2026"
        title="The clinic, in numbers."
        sub="Live across 3 doctors · PawsClinic KL · validated against a keyword baseline on 50 Telegram scenarios."
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm">
              Last 30 days
            </Button>
            <Button variant="soft" size="sm" icon={Icon.download(14)}>
              Export CSV
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorBanner error={error} onRetry={() => fetchAnalytics()} />
      )}

      {/* Section 1 — KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          animation: "fadeUp 480ms cubic-bezier(0.2,0.8,0.2,1) 40ms both",
        }}
      >
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} style={{ padding: "20px 22px 18px" }}>
              <Skeleton height={10} width={120} />
              <div style={{ height: 12 }} />
              <Skeleton height={36} width="70%" />
              <div style={{ height: 10 }} />
              <Skeleton height={10} width="60%" />
              <div style={{ height: 16 }} />
              <Skeleton height={28} width="100%" />
            </Card>
          ))
        ) : (
          <>
            <KPI
              label="Time saved"
              value="47h"
              delta="+12% vs last month"
              deltaTone="green"
              spark={sparkTime}
              sparkColor={C.greenDark}
            />
            <KPI
              label="Billing recovered"
              value="RM 9,200"
              delta="+RM 1,400 vs last month"
              deltaTone="green"
              spark={sparkBill}
              sparkColor={C.greenDark}
            />
            <KPI
              label="Complications caught"
              value="3"
              delta="target 2–4 / month"
              deltaTone="amber"
              spark={sparkComp}
              sparkColor={C.amber}
            />
            <KPI
              label="Triage response rate"
              value="78%"
              delta=">70% target · +4 pts MoM"
              deltaTone="green"
              spark={sparkResp}
              sparkColor={C.greenDark}
            />
          </>
        )}
      </div>

      {/* Section 2 — Triage decision distribution */}
      <Section
        kicker="§ 02 · Triage distribution"
        title="Where follow-up replies land this month"
        caption="GLM classifies every Telegram reply into one of three actions. Most are handled with zero doctor effort."
        delay={120}
      >
        <TriageDistribution />
      </Section>

      {/* Section 3 — GLM vs keyword baseline (pull-quote) */}
      <Section
        kicker="§ 03 · Validation — PRD §15"
        title="GLM 94% vs keyword 63%."
        caption={
          <>
            Keyword matching collapses on natural human language. GLM doesn't.
            That delta is why the model is non-removable.
          </>
        }
        right={
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 40,
                fontWeight: 600,
                color: C.greenDark,
                lineHeight: 1,
                letterSpacing: -1,
              }}
            >
              +31 pts
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: C.muted,
                marginTop: 4,
                letterSpacing: 0.4,
              }}
            >
              overall accuracy gain
            </div>
          </div>
        }
        delay={200}
      >
        <ValidationTable />
        <div
          style={{
            marginTop: 12,
            fontSize: 12.5,
            color: C.muted,
            fontStyle: "italic",
            lineHeight: 1.55,
            maxWidth: 680,
          }}
        >
          The <span style={{ color: C.brand, fontWeight: 600 }}>ambiguous</span>{" "}
          row is the proof — &quot;she seems a bit quiet but ate a little
          bit&quot; is not a keyword problem.
        </div>
      </Section>

      {/* Section 4 — Top diagnoses */}
      <Section
        kicker="§ 04 · Caseload"
        title="Top diagnoses — last 30 days"
        caption="Across 154 consults. Distribution matches typical solo-clinic pattern; otitis and GI lead, as expected in SEA urban pet populations."
        delay={280}
      >
        <TopDiagnosesBars rows={topDiagnoses} />
      </Section>

      {/* Section 5 — Corrections log */}
      <Section
        kicker="§ 05 · Feedback loop — PRD §F5"
        title="Doctor corrections, this week"
        caption="Every correction becomes a few-shot example for this clinic's future prompts. No model retraining. The GLM gets smarter per clinic automatically."
        delay={360}
      >
        <CorrectionsTable rows={corrRows} />
      </Section>

      {/* Section 6 — Follow-up funnel */}
      <Section
        kicker="§ 06 · Follow-up funnel"
        title="From Telegram ping to resolution"
        caption="412 follow-ups sent this month. Only 39 (12%) ever reached a doctor as an escalation card."
        delay={440}
      >
        <FollowUpFunnel />
      </Section>

      {/* Footer note — FT-style colophon */}
      <div
        style={{
          marginTop: 48,
          paddingTop: 18,
          borderTop: BORDER_HAIRLINE,
          display: "flex",
          gap: 12,
          alignItems: "baseline",
          color: C.hint,
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: 0.3,
          flexWrap: "wrap",
        }}
      >
        <span>CONSILIUM · ANALYTICS</span>
        <span style={{ color: C.border }}>·</span>
        <span>Clinic: PawsClinic KL</span>
        <span style={{ color: C.border }}>·</span>
        <span>Period: 01 Apr – 20 Apr 2026</span>
        <span style={{ color: C.border }}>·</span>
        <span>Validation set: 50 synthetic Telegram replies</span>
      </div>
    </div>
  );
}
