"use client";

/**
 * Gantt-style timeline of the parallel fan-out + orchestrator step.
 * Shared between dashboard and consult sidebar.
 */

import { BORDER_HAIRLINE, C, FONT_MONO, SHADOW_CARD } from "@/lib/tokens";
import {
  SUB_AGENTS,
  type AgentLanes,
  type OrchestratorRange,
} from "./types";

export function Timeline({
  lanes,
  orchestratorRange,
  t0,
  tEnd,
  compact,
}: {
  lanes: AgentLanes;
  orchestratorRange: OrchestratorRange;
  t0: number | null;
  tEnd: number | null;
  compact?: boolean;
}) {
  const end = tEnd ?? Date.now();
  const start = t0 ?? end;
  const span = Math.max(end - start, 1);

  const rows: { label: string; s?: number; e?: number; tone: "haiku" | "sonnet" }[] = [
    ...SUB_AGENTS.map((a) => ({
      label: a.label,
      s: lanes[a.id].startedAt,
      e: lanes[a.id].completedAt,
      tone: "haiku" as const,
    })),
    {
      label: "Orchestrator",
      s: orchestratorRange.s,
      e: orchestratorRange.e,
      tone: "sonnet" as const,
    },
  ];

  const empty = t0 == null;

  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 12,
        padding: compact ? "12px 14px" : "16px 20px",
        boxShadow: SHADOW_CARD,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
        {rows.map((r) => {
          const left = r.s ? ((r.s - start) / span) * 100 : 0;
          const width = r.s && r.e ? ((r.e - r.s) / span) * 100 : r.s ? Math.min(100 - left, 8) : 0;
          const color = r.tone === "haiku" ? C.brand : C.text;
          const bg = r.tone === "haiku" ? C.brandLight : "#1E293B22";
          const labelMs = r.s && r.e ? `${r.e - r.s}ms` : empty ? "" : r.s ? "running" : "";
          return (
            <div
              key={r.label}
              style={{
                display: "grid",
                gridTemplateColumns: compact ? "100px 1fr 60px" : "140px 1fr 80px",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontSize: compact ? 11.5 : 12.5, color: C.text, letterSpacing: -0.1 }}>
                {r.label}
              </div>
              <div
                style={{
                  position: "relative",
                  height: compact ? 12 : 16,
                  background: empty
                    ? "transparent"
                    : `linear-gradient(to right, ${C.borderSoft} 0%, ${C.borderSoft} 100%)`,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                {r.s && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: 0,
                      bottom: 0,
                      width: `${Math.max(width, 1.5)}%`,
                      background: bg,
                      borderLeft: `2px solid ${color}`,
                      transition: "width 180ms ease, left 180ms ease",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: compact ? 10 : 11,
                  fontFamily: FONT_MONO,
                  color: C.muted,
                  textAlign: "right",
                }}
              >
                {labelMs}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: compact ? 10 : 14,
          display: "flex",
          justifyContent: "space-between",
          fontSize: compact ? 9.5 : 10.5,
          fontFamily: FONT_MONO,
          color: C.hint,
        }}
      >
        <span>0ms</span>
        <span>{empty ? "—" : `${span}ms total`}</span>
      </div>
    </div>
  );
}
