export const C = {
  bg: "#F4F2ED",
  bgAlt: "#FBFAF6",
  card: "#FFFFFF",
  border: "#D9D6CF",
  borderSoft: "#E8E6E0",

  brand: "#4F46E5",
  brandDark: "#3730A3",
  brandLight: "#EEF2FF",
  brandBorder: "#C7D2FE",
  brandGlow: "#818CF8",

  green: "#059669",
  greenDark: "#047857",
  greenLight: "#ECFDF5",
  greenBorder: "#A7F3D0",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  amberBorder: "#FDE68A",
  red: "#DC2626",
  redLight: "#FEF2F2",
  redBorder: "#FECACA",

  text: "#0F172A",
  muted: "#64748B",
  hint: "#94A3B8",
  ink: "#1E293B",
} as const;

export const SHADOW_CARD = "0 1px 0 rgba(15,23,42,0.03)";
export const SHADOW_CARD_H = "0 2px 0 rgba(15,23,42,0.04)";
export const SHADOW_CTA = "0 1px 0 rgba(15,23,42,0.08)";
export const SHADOW_CTA_H = "0 1px 0 rgba(15,23,42,0.12)";

export const FONT_SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif";
export const FONT_SANS =
  "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', 'SF Mono', ui-monospace, monospace";

export const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16 } as const;

export const BORDER_HAIRLINE = "1px solid #E8E6E0";
export const BORDER_STRONG = "1px solid #D9D6CF";

export type Tone = "green" | "amber" | "red" | "neutral";
