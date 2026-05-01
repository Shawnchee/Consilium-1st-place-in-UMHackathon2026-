"use client";

/**
 * Live Tavily query feed. Cards animate in as the prescription / billing
 * sub-agents fire searches.
 */

import { Pill } from "@/components/atoms";
import { BORDER_HAIRLINE, C, FONT_MONO, SHADOW_CARD } from "@/lib/tokens";
import type { PipelineEvent } from "./types";

export function TavilyFeed({
  events,
  compact,
}: {
  events: Extract<PipelineEvent, { type: "tavily_called" }>[];
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 12,
        padding: compact ? 12 : 16,
        minHeight: compact ? 120 : 180,
        boxShadow: SHADOW_CARD,
      }}
    >
      {events.length === 0 ? (
        <div
          style={{
            color: C.muted,
            fontSize: compact ? 11.5 : 13,
            textAlign: "center",
            padding: compact ? "20px 0" : "32px 0",
            lineHeight: 1.5,
          }}
        >
          No Tavily searches yet. Prescription and billing agents fire only when needed —
          unfamiliar drugs, recall checks, or unmatched matrix items.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
          {events.map((e, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${C.amberBorder}`,
                background: C.amberLight,
                borderRadius: 8,
                padding: compact ? "8px 10px" : "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Pill tone="amber" style={{ textTransform: "uppercase", fontSize: 10 }}>
                  {e.agent}
                </Pill>
                <span style={{ fontSize: 11, color: C.muted }}>
                  {e.cached ? "cached" : "live"} · {e.results} result
                  {e.results === 1 ? "" : "s"}
                </span>
              </div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: compact ? 11.5 : 12,
                  color: C.text,
                }}
              >
                {e.query}
              </div>
              {!compact && (
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{e.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
