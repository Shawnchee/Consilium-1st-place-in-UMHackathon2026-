"use client";

/**
 * Static-but-animated architecture diagram for the multi-agent capture
 * pipeline. Each sub-agent card is driven by an AgentLane (idle/active/
 * done/failed); the orchestrator node is driven by an OrchestratorRange.
 *
 * Used by both the showcase dashboard and the consult-page sidebar.
 */

import { BORDER_HAIRLINE, C, FONT_MONO, SHADOW_CARD } from "@/lib/tokens";
import {
  SUB_AGENTS,
  type AgentLane,
  type AgentLanes,
  type OrchestratorRange,
  type SubAgentSpec,
} from "./types";

export function ArchitectureDiagram({
  lanes,
  orchestratorRange,
  compact,
}: {
  lanes: AgentLanes;
  orchestratorRange: OrchestratorRange;
  /** Tighter padding + smaller copy — used in the consult sidebar. */
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 12,
        padding: compact ? "16px 14px" : "28px 24px",
        boxShadow: SHADOW_CARD,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: compact ? 10 : 14 }}>
        <DiagramNode
          label="Consult input"
          sub="notes · transcript · photos"
          tone="neutral"
          width={compact ? 200 : 280}
        />
      </div>

      <ConnectorRow />

      <div style={{ textAlign: "center", marginBottom: compact ? 6 : 8 }}>
        <span
          style={{
            fontSize: compact ? 9.5 : 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          Parallel fan-out · Haiku 4.5
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact
            ? "repeat(5, minmax(0, 1fr))"
            : "repeat(5, 1fr)",
          gap: compact ? 6 : 12,
          marginBottom: compact ? 10 : 12,
        }}
      >
        {SUB_AGENTS.map((a) => (
          <SubAgentCard key={a.id} agent={a} lane={lanes[a.id]} compact={compact} />
        ))}
      </div>

      <ConnectorRow merging />

      <div style={{ display: "flex", justifyContent: "center", marginBottom: compact ? 10 : 14 }}>
        <DiagramNode
          label="Orchestrator"
          sub="Sonnet 4.6 · synthesize"
          tone={orchTone(orchestratorRange)}
          width={compact ? 240 : 320}
          accent
        />
      </div>

      <ConnectorRow splitting />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact ? 8 : 16 }}>
        <DiagramNode label="Doctor SOAP card" sub="dashboard view" tone="neutral" width="100%" />
        <DiagramNode label="Owner Telegram" sub="aftercare + tone-tuned" tone="neutral" width="100%" />
      </div>

      <ConnectorRow dashed />

      <div style={{ display: "flex", justifyContent: "center" }}>
        <EvidenceCheckNode compact={compact} />
      </div>
    </div>
  );
}

function EvidenceCheckNode({ compact }: { compact?: boolean }) {
  return (
    <div
      style={{
        width: compact ? 260 : 360,
        background: C.amberLight,
        borderTop: `1px dashed ${C.amberBorder}`,
        borderRight: `1px dashed ${C.amberBorder}`,
        borderBottom: `1px dashed ${C.amberBorder}`,
        borderLeft: `3px dashed ${C.amber}`,
        borderRadius: 10,
        padding: compact ? "10px 12px" : "12px 14px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: compact ? 12.5 : 13,
            fontWeight: 600,
            color: C.text,
            letterSpacing: -0.1,
          }}
        >
          Evidence Check
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            color: C.amber,
            background: "#FFFFFF",
            border: `1px solid ${C.amberBorder}`,
            borderRadius: 4,
            padding: "1px 4px",
          }}
        >
          TAVILY
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
        off critical path · recent recalls + new contraindications
      </div>
    </div>
  );
}

function orchTone(r: OrchestratorRange): "active" | "done" | "neutral" {
  if (r.e) return "done";
  if (r.s) return "active";
  return "neutral";
}

function SubAgentCard({
  agent,
  lane,
  compact,
}: {
  agent: SubAgentSpec;
  lane: AgentLane;
  compact?: boolean;
}) {
  const tone: "neutral" | "active" | "done" | "failed" = lane.failed
    ? "failed"
    : lane.completedAt
      ? "done"
      : lane.startedAt
        ? "active"
        : "neutral";
  const colors = {
    neutral: { border: C.border, bg: "#FFFFFF", dot: C.hint, label: C.muted },
    active: { border: C.brandBorder, bg: C.brandLight, dot: C.brand, label: C.text },
    done: { border: C.greenBorder, bg: C.greenLight, dot: C.green, label: C.text },
    failed: { border: C.redBorder, bg: C.redLight, dot: C.red, label: C.text },
  }[tone];
  const latency = lane.startedAt && lane.completedAt ? lane.completedAt - lane.startedAt : null;

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: compact ? "8px 10px" : "10px 12px",
        position: "relative",
        transition: "background 220ms ease, border-color 220ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: compact ? 2 : 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: colors.dot,
            boxShadow: tone === "active" ? `0 0 0 4px ${C.brandLight}` : undefined,
            animation: tone === "active" ? "agentPulse 1.2s ease-in-out infinite" : undefined,
          }}
        />
        <span
          style={{
            fontSize: compact ? 12 : 13,
            fontWeight: 600,
            color: colors.label,
            letterSpacing: -0.1,
          }}
        >
          {agent.label}
        </span>
      </div>
      {!compact && (
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45 }}>{agent.hint}</div>
      )}
      <div
        style={{
          marginTop: compact ? 3 : 6,
          fontSize: compact ? 10 : 10.5,
          fontFamily: FONT_MONO,
          color: tone === "neutral" ? C.hint : C.ink,
        }}
      >
        {tone === "neutral" && "queued"}
        {tone === "active" && "running…"}
        {tone === "done" && latency != null && `${latency}ms`}
        {tone === "failed" && (lane.failed?.slice(0, 32) ?? "failed")}
      </div>

      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

function DiagramNode({
  label,
  sub,
  tone,
  width,
  accent,
}: {
  label: string;
  sub: string;
  tone: "neutral" | "active" | "done";
  width: number | string;
  accent?: boolean;
}) {
  const colors = {
    neutral: { border: C.border, bg: "#FFFFFF" },
    active: { border: C.brandBorder, bg: C.brandLight },
    done: { border: C.greenBorder, bg: C.greenLight },
  }[tone];
  return (
    <div
      style={{
        width,
        background: colors.bg,
        // Separate longhand sides — mixing `border` shorthand and
        // `borderLeft` triggers a React warning about conflicting
        // properties on rerender.
        borderTop: `1px solid ${colors.border}`,
        borderRight: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        borderLeft: accent
          ? `3px solid ${C.text}`
          : `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        textAlign: "center",
        transition: "background 220ms ease, border-color 220ms ease",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: -0.1 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ConnectorRow({
  merging,
  splitting,
  dashed,
}: {
  merging?: boolean;
  splitting?: boolean;
  dashed?: boolean;
}) {
  const stroke = dashed ? C.amberBorder : C.border;
  const dashArray = dashed ? "4 4" : undefined;
  return (
    <svg
      viewBox="0 0 600 28"
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: 28, margin: "2px 0" }}
    >
      {merging ? (
        <>
          <line x1="60" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
          <line x1="180" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
          <line x1="300" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
          <line x1="420" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
          <line x1="540" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
        </>
      ) : splitting ? (
        <>
          <line x1="300" y1="0" x2="180" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
          <line x1="300" y1="0" x2="420" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
        </>
      ) : dashed ? (
        <line x1="300" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" strokeDasharray={dashArray} />
      ) : (
        <>
          <line x1="300" y1="0" x2="60" y2="28" stroke={stroke} strokeWidth="1" />
          <line x1="300" y1="0" x2="180" y2="28" stroke={stroke} strokeWidth="1" />
          <line x1="300" y1="0" x2="300" y2="28" stroke={stroke} strokeWidth="1" />
          <line x1="300" y1="0" x2="420" y2="28" stroke={stroke} strokeWidth="1" />
          <line x1="300" y1="0" x2="540" y2="28" stroke={stroke} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
