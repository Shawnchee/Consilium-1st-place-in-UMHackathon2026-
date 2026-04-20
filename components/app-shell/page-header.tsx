"use client";

import { ReactNode } from "react";
import { BORDER_HAIRLINE, C, FONT_SERIF, RADIUS } from "@/lib/tokens";

/* ------------------------------------------------------------------
   PageHeader — title in serif (editorial), muted subtitle in sans,
   thin hairline divider below. No gradient.
   ------------------------------------------------------------------ */
export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "36px 0 20px",
        marginBottom: 24,
        borderBottom: BORDER_HAIRLINE,
        display: "flex",
        alignItems: "flex-end",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
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
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontFamily: FONT_SERIF,
            fontSize: "clamp(28px, 3.2vw, 36px)",
            fontWeight: 600,
            letterSpacing: -0.6,
            margin: "0 0 8px",
            lineHeight: 1.1,
            color: C.text,
          }}
        >
          {title}
        </h2>
        {sub && (
          <div
            style={{
              fontSize: 14.5,
              color: C.muted,
              maxWidth: 680,
              lineHeight: 1.5,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export function SectionTitle({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
      <h3
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          margin: 0,
          color: C.muted,
        }}
      >
        {title}
      </h3>
      {count != null && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
            fontSize: 11,
            color: C.hint,
          }}
        >
          {count}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}

export function PetAvatar({ name }: { name: string; species?: "Dog" | "Cat" }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        background: "#FFFFFF",
        color: C.text,
        display: "grid",
        placeItems: "center",
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: -0.3,
        flexShrink: 0,
        border: BORDER_HAIRLINE,
        fontFamily: FONT_SERIF,
      }}
    >
      {name[0]?.toUpperCase() ?? "·"}
    </div>
  );
}

export function BriefRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 12,
        padding: "5px 0",
      }}
    >
      <div style={{ color: C.muted, fontSize: 13, fontWeight: 500 }}>{k}:</div>
      <div style={{ fontSize: 14, color: C.text }}>{v}</div>
    </div>
  );
}
