"use client";

/**
 * Sticky arrival banner — fires when the StoreProvider sees a new
 * patient INSERT come through Supabase Realtime (e.g. the receptionist
 * just submitted on /receptionist). Click → jump straight into the
 * consult for that patient. Auto-dismisses after 45s if the doctor
 * doesn't act on it.
 */

import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "./store";
import { C, FONT_MONO, RADIUS } from "@/lib/tokens";

const AUTO_DISMISS_MS = 45_000;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export default function NewPatientBanner() {
  const { newPatientArrival, dismissNewPatientArrival } = useStore();

  useEffect(() => {
    if (!newPatientArrival) return;
    const t = setTimeout(dismissNewPatientArrival, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [newPatientArrival, dismissNewPatientArrival]);

  return (
    <AnimatePresence>
      {newPatientArrival && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            position: "sticky",
            top: 60,
            zIndex: 40,
            margin: "12px 32px 0",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 18px",
            background: C.brandLight,
            border: `1px solid ${C.brandBorder}`,
            borderRadius: RADIUS.md,
            boxShadow: "0 4px 18px -8px rgba(79,70,229,0.35)",
          }}
        >
          <span
            style={{
              fontSize: 20,
              lineHeight: 1,
            }}
            aria-hidden
          >
            🐾
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: C.brandDark,
              }}
            >
              New intake from reception
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                marginTop: 2,
              }}
            >
              {newPatientArrival.name} just arrived
              <span
                style={{
                  marginLeft: 10,
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: C.muted,
                  fontWeight: 400,
                }}
              >
                · brief generating
              </span>
            </div>
            {newPatientArrival.reason && (
              <div
                style={{
                  fontSize: 12.5,
                  fontStyle: "italic",
                  color: C.muted,
                  marginTop: 3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={newPatientArrival.reason}
              >
                here for: {truncate(newPatientArrival.reason, 100)}
              </div>
            )}
          </div>
          <Link
            href={`/consult?pid=${newPatientArrival.id}`}
            onClick={dismissNewPatientArrival}
            style={{
              padding: "8px 14px",
              borderRadius: RADIUS.sm,
              background: C.brand,
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Open consult →
          </Link>
          <button
            type="button"
            onClick={dismissNewPatientArrival}
            aria-label="Dismiss"
            style={{
              width: 28,
              height: 28,
              borderRadius: RADIUS.sm,
              background: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
