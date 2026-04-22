"use client";

import { CSSProperties } from "react";
import { C } from "@/lib/tokens";

/**
 * Neutral skeleton primitive. Hairline pulse — tuned to match the editorial
 * card palette (no shimmer, no gradient). Pair with `style` to size per use.
 */
export function Skeleton({
  height = 14,
  width = "100%",
  radius = 6,
  style,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        height,
        width,
        background: C.borderSoft,
        borderRadius: radius,
        animation: "skeletonPulse 1.3s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/* ─── Presets ───────────────────────────────────────────────────────── */

export function SkeletonKpiCard({ index = 0 }: { index?: number }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 12,
        padding: "22px 22px 20px",
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        animationDelay: `${index * 70}ms`,
      }}
    >
      <Skeleton height={10} width={110} />
      <Skeleton height={34} width="70%" />
      <div style={{ flex: 1 }} />
      <Skeleton height={10} width="60%" />
    </div>
  );
}

export function SkeletonPatientRow({ index = 0 }: { index?: number }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 12,
        padding: "20px 22px",
        minHeight: 80,
        display: "flex",
        alignItems: "center",
        gap: 18,
        animationDelay: `${index * 55}ms`,
      }}
    >
      <Skeleton height={14} width={48} />
      <Skeleton height={44} width={44} radius="50%" />
      <div style={{ flex: 1, display: "grid", gap: 6 }}>
        <Skeleton height={16} width="40%" />
        <Skeleton height={12} width="60%" />
      </div>
      <Skeleton height={12} width={50} />
    </div>
  );
}

export function SkeletonEscalationCard({ index = 0 }: { index?: number }) {
  return (
    <div
      style={{
        background: C.card,
        borderTop: `1px solid ${C.borderSoft}`,
        borderRight: `1px solid ${C.borderSoft}`,
        borderBottom: `1px solid ${C.borderSoft}`,
        borderLeft: `2px solid ${C.borderSoft}`,
        borderRadius: 12,
        padding: "20px 22px",
        minHeight: 110,
        display: "grid",
        gap: 10,
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton height={8} width={8} radius="50%" />
        <Skeleton height={16} width={110} />
        <Skeleton height={12} width={160} />
      </div>
      <Skeleton height={12} width="95%" />
      <Skeleton height={12} width="80%" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <Skeleton height={12} width={100} />
        <div style={{ flex: 1 }} />
        <Skeleton height={26} width={72} radius={6} />
      </div>
    </div>
  );
}

export function SkeletonBrief() {
  return (
    <div style={{ display: "grid", gap: 14, padding: "16px 24px 8px" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr",
            gap: 16,
            alignItems: "center",
          }}
        >
          <Skeleton height={10} width={90} />
          <Skeleton height={12} width={`${70 + ((i * 7) % 20)}%`} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBar({ width = "60%" }: { width?: number | string }) {
  return <Skeleton height={14} width={width} />;
}
