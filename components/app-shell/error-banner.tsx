"use client";

import { C, BORDER_HAIRLINE, FONT_MONO } from "@/lib/tokens";

/**
 * Inline error banner for load failures. Subtle red left-accent; pairs with
 * a retry button. Used at the top of data-driven pages.
 */
export function ErrorBanner({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        marginBottom: 20,
        padding: "12px 16px",
        borderRadius: 10,
        background: C.card,
        border: BORDER_HAIRLINE,
        borderLeft: `3px solid ${C.red}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        animation: "slideIn 220ms ease both",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: C.red,
        }}
      >
        Load error
      </div>
      <div
        style={{
          fontSize: 13,
          color: C.text,
          fontFamily: FONT_MONO,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {error}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
            borderBottom: `1px solid ${C.text}`,
            paddingBottom: 1,
            background: "transparent",
            letterSpacing: 0.1,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
