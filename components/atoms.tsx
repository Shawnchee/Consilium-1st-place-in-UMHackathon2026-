"use client";

import {
  CSSProperties,
  ReactNode,
  useState,
} from "react";
import {
  BORDER_HAIRLINE,
  C,
  FONT_SERIF,
  RADIUS,
  SHADOW_CARD,
  SHADOW_CARD_H,
  Tone,
} from "@/lib/tokens";

/* ------------------------------------------------------------------
   Pill — rounded-full, hairline border in tone color at low opacity,
   tone-colored text, white background. Not a wash.
   ------------------------------------------------------------------ */
export function Pill({
  children,
  tone = "neutral",
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}) {
  const tones: Record<Tone, { fg: string; bd: string }> = {
    green: { fg: C.greenDark, bd: "rgba(5,150,105,0.28)" },
    amber: { fg: C.amber, bd: "rgba(217,119,6,0.28)" },
    red: { fg: C.red, bd: "rgba(220,38,38,0.28)" },
    neutral: { fg: C.ink, bd: C.border },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: "#FFFFFF",
        border: `1px solid ${t.bd}`,
        color: t.fg,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.1,
        lineHeight: 1.6,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------
   Dot — solid tone color, 6px default. Pulse option retained.
   ------------------------------------------------------------------ */
export function Dot({
  color = C.red,
  size = 6,
  pulsing = false,
  style,
}: {
  color?: string;
  size?: number;
  pulsing?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
    >
      {pulsing && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: color,
            animation: "pulseRing 1.6s ease-out infinite",
          }}
        />
      )}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          animation: pulsing ? "pulse 1.6s ease-in-out infinite" : "none",
        }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------
   Card — RADIUS.lg (12px), hairline border, flat hairline shadow.
   No inner gradients.
   ------------------------------------------------------------------ */
export function Card({
  children,
  style,
  hoverable = false,
  onClick,
  active = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  hoverable?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const lift = hoverable && hover;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.card,
        border: active
          ? `1px solid ${C.text}`
          : BORDER_HAIRLINE,
        borderRadius: RADIUS.lg,
        boxShadow: lift ? SHADOW_CARD_H : SHADOW_CARD,
        transform: lift ? "translateY(-1px)" : "translateY(0)",
        transition:
          "transform 140ms ease, box-shadow 180ms ease, border-color 180ms ease",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------
   Button — flat, 8px radius base, hairline border default.
   primary  = solid #0F172A (C.text) with white text
   ghost    = transparent, hairline border on hover
   soft     = secondary — white + hairline
   dark     = alias for primary (kept for API compat)
   danger   = solid red (for rare destructive actions only)
   Optional: serif={true} uses FONT_SERIF.
   ------------------------------------------------------------------ */
type ButtonVariant = "primary" | "ghost" | "soft" | "dark" | "danger";

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  style,
  icon,
  iconRight,
  type = "button",
  serif = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
  icon?: ReactNode;
  iconRight?: ReactNode;
  type?: "button" | "submit" | "reset";
  serif?: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const sizes = {
    sm: { padding: "7px 13px", fontSize: 13, borderRadius: RADIUS.md },
    md: { padding: "10px 16px", fontSize: 14, borderRadius: RADIUS.md },
    lg: { padding: "13px 22px", fontSize: 15, borderRadius: RADIUS.md },
  } as const;
  const base = sizes[size];

  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: C.text, // #0F172A
      color: "#FFFFFF",
      border: "1px solid transparent",
      boxShadow: "none",
      filter: press ? "brightness(.90)" : hover ? "brightness(1.08)" : "none",
    },
    ghost: {
      background: "transparent",
      color: C.text,
      border: `1px solid ${hover ? C.border : "transparent"}`,
      boxShadow: "none",
      filter: press ? "brightness(.96)" : "none",
    },
    soft: {
      background: "#FFFFFF",
      color: C.text,
      border: BORDER_HAIRLINE,
      boxShadow: "none",
      filter: hover ? "brightness(.98)" : "none",
    },
    dark: {
      background: C.text,
      color: "#FFFFFF",
      border: "1px solid transparent",
      boxShadow: "none",
      filter: press ? "brightness(.90)" : hover ? "brightness(1.08)" : "none",
    },
    danger: {
      background: C.red,
      color: "#FFFFFF",
      border: "1px solid transparent",
      boxShadow: "none",
      filter: press ? "brightness(.90)" : hover ? "brightness(1.06)" : "none",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        ...base,
        ...variants[variant],
        fontWeight: 600,
        letterSpacing: 0.05,
        fontFamily: serif ? FONT_SERIF : "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "filter 120ms ease, border-color 120ms ease",
        ...style,
      }}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

/* ------------------------------------------------------------------
   Icon set — unchanged SVG pass-through.
   ------------------------------------------------------------------ */
type IconFn = (s?: number) => ReactNode;
type ChevronFn = (s?: number, dir?: "up" | "down") => ReactNode;

export const Icon: Record<string, IconFn> & { chevron: ChevronFn } = {
  mic: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  ),
  arrow: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  back: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 19l-7-7 7-7" />
    </svg>
  ),
  check: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  warn: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L2 21h20L12 3z" />
      <path d="M12 10v5M12 18h.01" />
    </svg>
  ),
  chevron: (s = 16, dir: "up" | "down" = "down") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === "up" ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  phone: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  edit: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
  download: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  paw: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="5.5" cy="10" rx="2" ry="2.6" />
      <ellipse cx="9.5" cy="6" rx="2" ry="2.6" />
      <ellipse cx="14.5" cy="6" rx="2" ry="2.6" />
      <ellipse cx="18.5" cy="10" rx="2" ry="2.6" />
      <path d="M12 11c-3.2 0-5.5 2.5-5.5 5 0 2 1.7 3 3.5 3 1.1 0 1.4-.4 2-.4s.9.4 2 .4c1.8 0 3.5-1 3.5-3 0-2.5-2.3-5-5.5-5z" />
    </svg>
  ),
  spark: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  ),
  clock: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  brain: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0-2 5c-1 1-1 3 0 4 0 2 1 3 3 3a3 3 0 0 0 3 3 3 3 0 0 0 2-1M12 5v12M12 5a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1 2 5c1 1 1 3 0 4 0 2-1 3-3 3a3 3 0 0 1-3 3 3 3 0 0 1-2-1" />
    </svg>
  ),
  chat: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  shield: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  coin: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="9" ry="3" />
      <path d="M3 6v12c0 1.7 4 3 9 3s9-1.3 9-3V6M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
    </svg>
  ),
};
