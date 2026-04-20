"use client";

import { useEffect, useState } from "react";
import { Button, Dot, Icon } from "@/components/atoms";
import {
  BORDER_HAIRLINE,
  C,
  FONT_MONO,
  FONT_SERIF,
  RADIUS,
  SHADOW_CARD,
} from "@/lib/tokens";
import type { Differential } from "@/lib/types";
import { useStore } from "./store";

function DifferentialBar({
  d,
  delay,
  mounted,
}: {
  d: Differential;
  delay: number;
  mounted: boolean;
}) {
  const tone = d.tone === "red" ? C.red : C.green;
  const pct = Math.round(d.prob * 100);
  return (
    <div
      style={{
        border: BORDER_HAIRLINE,
        borderRadius: RADIUS.md,
        padding: "12px 14px",
        background: C.card,
        borderLeft: `3px solid ${tone}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
        <Dot color={tone} size={6} />
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, flex: 1 }}>
          {d.cause}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 14,
            fontWeight: 600,
            color: tone,
            letterSpacing: -0.2,
          }}
        >
          {pct}%
        </div>
      </div>
      {/* Flat solid fill — no gradient */}
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: "#F1EFEA",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 999,
            background: tone,
            width: mounted ? `${pct}%` : "0%",
            transition: `width 900ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

export default function EscalationModal() {
  const { escalation, closeEscalation, approveEscalation } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!escalation) return;
    const t = setTimeout(() => setMounted(true), 10);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEscalation();
    };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
      setMounted(false);
    };
  }, [escalation, closeEscalation]);

  if (!escalation) return null;
  const f = escalation;

  return (
    <div
      onClick={closeEscalation}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        animation: "backdropIn 220ms ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: RADIUS.lg,
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: SHADOW_CARD,
          animation: "modalIn 320ms cubic-bezier(0.2,0.8,0.2,1) both",
          border: BORDER_HAIRLINE,
        }}
      >
        {/* Header — thin red accent left border, no wash */}
        <div
          style={{
            padding: "22px 28px 18px",
            borderBottom: BORDER_HAIRLINE,
            borderLeft: `3px solid ${C.red}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Dot color={C.red} size={8} pulsing />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: C.red,
              }}
            >
              Escalation Required
            </div>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 22,
                fontWeight: 600,
                color: C.text,
                marginTop: 3,
                letterSpacing: -0.4,
              }}
            >
              {f.patient} · {f.procedure}
            </div>
          </div>
          <button
            onClick={closeEscalation}
            style={{
              width: 30,
              height: 30,
              borderRadius: RADIUS.sm,
              background: "transparent",
              color: C.muted,
              border: BORDER_HAIRLINE,
              fontSize: 16,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: "22px 28px" }}>
          {/* Owner message — quoted, italic, per PRD §F3 */}
          <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "baseline" }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: C.muted,
              }}
            >
              Owner message
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: C.hint,
              }}
            >
              {f.tsLabel} · via Telegram
            </div>
          </div>
          <blockquote
            style={{
              margin: 0,
              padding: "14px 18px",
              borderRadius: RADIUS.md,
              background: "#FBFAF7",
              borderLeft: `3px solid ${C.border}`,
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontSize: 16,
              lineHeight: 1.5,
              color: C.ink,
              marginBottom: 24,
            }}
          >
            &ldquo;{f.ownerMessage}&rdquo;
            <div
              style={{
                fontFamily: "inherit",
                fontSize: 11,
                fontStyle: "normal",
                color: C.muted,
                marginTop: 8,
                letterSpacing: 0.2,
              }}
            >
              — {f.owner}
            </div>
          </blockquote>

          {/* Differentials */}
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: C.muted,
              marginBottom: 10,
            }}
          >
            Differential diagnoses · GLM confidence
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
            {(f.differentials || []).map((d, i) => (
              <DifferentialBar key={i} d={d} delay={100 + i * 120} mounted={mounted} />
            ))}
          </div>

          {/* Recommended action — thin amber left accent, white bg */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: RADIUS.md,
              background: C.card,
              border: BORDER_HAIRLINE,
              borderLeft: `3px solid ${C.amber}`,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: C.amber, display: "grid", placeItems: "center" }}>
                {Icon.warn(13)}
              </span>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: C.amber,
                  textTransform: "uppercase",
                }}
              >
                Recommended action
              </div>
            </div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, lineHeight: 1.5 }}>
              {f.recommendation}
            </div>
          </div>

          {/* Draft response — mono font, hairline border */}
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: C.muted,
              marginBottom: 8,
            }}
          >
            Draft response · ready to send
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: RADIUS.md,
              background: "#FBFAF7",
              border: BORDER_HAIRLINE,
              fontFamily: FONT_MONO,
              fontSize: 13,
              lineHeight: 1.6,
              color: C.ink,
              marginBottom: 16,
              whiteSpace: "pre-wrap",
            }}
          >
            {f.draft}
          </div>
        </div>

        {/* Action bar — PRD §F3: [Approve & Send] [Edit] [Call] */}
        <div
          style={{
            padding: "16px 28px 22px",
            borderTop: BORDER_HAIRLINE,
            display: "flex",
            gap: 10,
            alignItems: "center",
            background: "#FBFAF7",
          }}
        >
          <Button size="md" onClick={approveEscalation} icon={Icon.check(15)}>
            Approve &amp; Send
          </Button>
          <Button variant="soft" size="md" icon={Icon.edit(14)}>
            Edit
          </Button>
          <Button variant="soft" size="md" icon={Icon.phone(14)}>
            Call Owner
          </Button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11.5, color: C.muted }}>
            Logs feedback · auto-sends via Telegram
          </div>
        </div>
      </div>
    </div>
  );
}
