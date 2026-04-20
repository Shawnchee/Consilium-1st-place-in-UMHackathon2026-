"use client";

import { Icon } from "@/components/atoms";
import { BORDER_HAIRLINE, C, SHADOW_CARD } from "@/lib/tokens";
import { useStore } from "./store";

export default function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        background: "#FFFFFF",
        color: C.text,
        padding: "9px 14px 9px 12px",
        borderRadius: 999,
        border: BORDER_HAIRLINE,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: -0.1,
        boxShadow: SHADOW_CARD,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        animation: "slideIn 220ms ease both",
      }}
    >
      <span
        style={{
          color: C.green,
          display: "grid",
          placeItems: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `1px solid ${C.greenBorder}`,
        }}
      >
        {Icon.check(11)}
      </span>
      <span>{toast}</span>
    </div>
  );
}
