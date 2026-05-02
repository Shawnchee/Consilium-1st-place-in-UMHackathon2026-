"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/atoms";
import { BORDER_HAIRLINE, C, FONT_SERIF } from "@/lib/tokens";
import { CLINIC } from "@/lib/clinic";
import { useStore } from "./store";

export default function Header() {
  const pathname = usePathname();
  const { followups } = useStore();
  const urgentCount = followups.filter((f) => f.level === "escalate").length;

  // PRD §12 nav order: Dashboard, Consult, Follow-ups, Passports, Analytics.
  // Follow-ups now lives on its own dedicated route.
  const tabs = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/consult", label: "Consult" },
    { href: "/follow-ups", label: "Follow-ups" },
    { href: "/passport", label: "Passports" },
    { href: "/analytics", label: "Analytics" },
    { href: "/knowledge", label: "Knowledge" },
    { href: "/agent-team-analytics-dashboard", label: "Agent Team" },
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#FFFFFF",
        borderBottom: BORDER_HAIRLINE,
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        height: 60,
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: C.text,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span style={{ color: "#fff", display: "grid", placeItems: "center" }}>
            {Icon.paw(16)}
          </span>
        </div>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: -0.3,
            color: C.text,
          }}
        >
          Consilium
        </div>
      </Link>

      {/* Tabs — sans, tightened tracking, 2px bottom accent on active */}
      <nav style={{ display: "flex", gap: 2, marginLeft: 16, height: "100%" }}>
        {tabs.map((t) => {
          const isActive =
            pathname === t.href || pathname?.startsWith(t.href + "/");
          return (
            <Link
              key={t.label}
              href={t.href}
              style={{ textDecoration: "none", display: "flex" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: -0.1,
                  color: isActive ? C.text : C.muted,
                  borderBottom: isActive
                    ? `2px solid ${C.text}`
                    : "2px solid transparent",
                  marginBottom: -1,
                  transition: "color 140ms ease",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Urgent count — red dot + number, no wash */}
      {urgentCount > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: C.text,
            letterSpacing: -0.1,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.red,
            }}
          />
          {urgentCount} urgent
        </div>
      )}

      {/* Clinic + date */}
      <div
        style={{
          fontSize: 12.5,
          color: C.muted,
          letterSpacing: -0.1,
          borderLeft: BORDER_HAIRLINE,
          paddingLeft: 16,
        }}
      >
        {CLINIC.name} · Mon 20 Apr
      </div>

      {/* Doctor identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
            {CLINIC.doctor}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>Lead veterinarian</div>
        </div>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#FFFFFF",
            color: C.text,
            fontWeight: 600,
            fontSize: 13,
            display: "grid",
            placeItems: "center",
            border: BORDER_HAIRLINE,
            fontFamily: FONT_SERIF,
          }}
        >
          A
        </div>
      </div>
    </div>
  );
}
