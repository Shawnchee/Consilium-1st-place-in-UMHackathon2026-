"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dot, Pill } from "@/components/atoms";
import { useStore } from "@/components/app-shell/store";
import {
  SkeletonBrief,
  SkeletonKpiCard,
  SkeletonPatientRow,
} from "@/components/app-shell/skeleton";
import { ErrorBanner } from "@/components/app-shell/error-banner";
import { AddPatientModal } from "@/components/app-shell/add-patient-modal";
import { CLINIC } from "@/lib/clinic";
import { C, FONT_SERIF, FONT_MONO } from "@/lib/tokens";
import type { MetricCardData, Patient } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Hero — greeting + priority banner                                  */
/* ------------------------------------------------------------------ */

function HeroRow({ escalationCount }: { escalationCount: number }) {
  return (
    <div
      style={{
        padding: "36px 0 28px",
        marginBottom: 32,
        borderBottom: `1px solid ${C.borderSoft}`,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
        gap: 32,
        alignItems: "end",
        animation: "fadeUp 420ms ease both",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: C.muted,
            marginBottom: 10,
          }}
        >
          Dashboard
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: FONT_SERIF,
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: -0.8,
            color: C.text,
            lineHeight: 1.08,
          }}
        >
          Good morning, {CLINIC.doctor}.
        </h1>
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: C.muted,
            letterSpacing: 0.1,
          }}
        >
          {CLINIC.name}
          <span style={{ margin: "0 10px", color: C.hint }}>·</span>
          Tue 21 Apr 2026
        </div>
      </div>

      <PriorityBanner escalationCount={escalationCount} />
    </div>
  );
}

function PriorityBanner({ escalationCount }: { escalationCount: number }) {
  const urgent = escalationCount > 0;
  const accent = urgent ? C.red : C.green;

  return (
    <Link
      href="/follow-ups"
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          background: C.card,
          borderTop: `1px solid ${C.borderSoft}`,
          borderRight: `1px solid ${C.borderSoft}`,
          borderBottom: `1px solid ${C.borderSoft}`,
          borderLeft: `2px solid ${accent}`,
          borderRadius: 12,
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          transition: "transform 140ms ease",
        }}
      >
        <Dot color={accent} size={8} pulsing={urgent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 17,
              fontWeight: 500,
              color: C.text,
              letterSpacing: -0.2,
            }}
          >
            {urgent
              ? `${escalationCount} case${escalationCount === 1 ? "" : "s"} need you`
              : "All follow-ups clear"}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            {urgent
              ? "Escalations waiting in the follow-up queue"
              : "No escalations · nothing waiting"}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
            borderBottom: `1px solid ${C.text}`,
            paddingBottom: 1,
            letterSpacing: 0.1,
          }}
        >
          Review →
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Row — 4 cards full-width                                       */
/* ------------------------------------------------------------------ */

const METRIC_DELTAS: Record<string, string> = {
  "Time saved": "+18% vs Mar",
  "Billing recovered": "+12% vs Mar",
  "Complications caught": "+1 vs Mar",
  "Follow-up response": "+4pts vs Mar",
};

const METRIC_TARGETS: Record<string, string> = {
  "Time saved": "Target 3h/doctor/day",
  "Billing recovered": "Target RM 8–12k",
  "Complications caught": "Target 2–4",
  "Follow-up response": "Target >70%",
};

function KpiCard({ m, index }: { m: MetricCardData; index: number }) {
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
        justifyContent: "space-between",
        animation: "fadeUp 480ms ease both",
        animationDelay: `${120 + index * 70}ms`,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: 1.6,
          color: C.muted,
          fontWeight: 700,
        }}
      >
        {m.label}
      </div>
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 38,
          fontWeight: 500,
          color: C.text,
          marginTop: 14,
          letterSpacing: -1.2,
          lineHeight: 1,
        }}
      >
        {m.value}
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11.5,
          color: C.hint,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            color: C.muted,
            fontSize: 11.5,
          }}
        >
          {METRIC_DELTAS[m.label] ?? ""}
        </span>
        <span style={{ color: C.hint }}>·</span>
        <span>{METRIC_TARGETS[m.label] ?? m.sub}</span>
      </div>
    </div>
  );
}

function KpiRow({
  metrics,
  loading,
}: {
  metrics: MetricCardData[];
  loading: boolean;
}) {
  const showSkeleton = loading && metrics.length === 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 32,
      }}
    >
      {showSkeleton
        ? [0, 1, 2, 3].map((i) => <SkeletonKpiCard key={i} index={i} />)
        : metrics.map((m, i) => <KpiCard key={m.label} m={m} index={i} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Patient schedule (left column)                                     */
/* ------------------------------------------------------------------ */

function BriefLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 16,
        padding: "8px 0",
        fontSize: 14,
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          color: C.muted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.3,
          fontWeight: 600,
          paddingTop: 3,
        }}
      >
        {label}
      </div>
      <div style={{ color: C.text }}>{value}</div>
    </div>
  );
}

function PatientRow({
  p,
  expanded,
  onToggle,
  index,
}: {
  p: Patient;
  expanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const [briefReady, setBriefReady] = useState(false);
  useEffect(() => {
    if (!expanded) {
      setBriefReady(false);
      return;
    }
    const t = setTimeout(() => setBriefReady(true), 200);
    return () => clearTimeout(t);
  }, [expanded]);
  return (
    <div
      style={{
        animation: "fadeUp 480ms ease both",
        animationDelay: `${120 + index * 55}ms`,
      }}
    >
      <div
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: C.card,
          border: `1px solid ${hover || expanded ? C.border : C.borderSoft}`,
          borderRadius: 12,
          padding: "20px 22px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 18,
          minHeight: 80,
          transform: hover && !expanded ? "translateY(-1px)" : "translateY(0)",
          transition: "transform 140ms ease, border-color 160ms ease",
        }}
      >
        {/* Time */}
        <div
          style={{
            minWidth: 58,
            fontFamily: FONT_MONO,
            fontSize: 14,
            color: C.muted,
            letterSpacing: 0.2,
          }}
        >
          {p.time}
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: C.bgAlt,
            border: `1px solid ${C.borderSoft}`,
            display: "grid",
            placeItems: "center",
            fontFamily: FONT_SERIF,
            fontSize: 17,
            fontWeight: 500,
            color: C.ink,
            flexShrink: 0,
          }}
        >
          {p.name[0]}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 18,
                fontWeight: 500,
                color: C.text,
                letterSpacing: -0.2,
              }}
            >
              {p.name}
            </div>
            <Pill tone={p.tagColor} style={{ fontSize: 10.5, padding: "2px 9px" }}>
              {p.tag}
            </Pill>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 5 }}>
            {p.species} · {p.age} · Owner {p.owner}
          </div>
        </div>

        {/* Brief affordance */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: expanded ? C.text : C.muted,
            letterSpacing: 0.1,
            borderBottom: `1px solid ${expanded ? C.text : "transparent"}`,
            paddingBottom: 1,
          }}
        >
          {expanded ? "Hide brief" : "Brief →"}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 8,
            background: C.card,
            border: `1px solid ${C.borderSoft}`,
            borderRadius: 12,
            animation: "fadeUp 260ms ease both",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              borderBottom: `1px solid ${C.borderSoft}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: C.muted,
              }}
            >
              Pre-consult brief
            </div>
            <div style={{ fontSize: 11.5, color: C.hint }}>
              · generated from historical visits
            </div>
          </div>

          {briefReady ? (
            <div style={{ padding: "16px 24px 8px" }}>
              <BriefLine label="Last visit" value={p.brief.lastVisit} />
              <BriefLine label="Chronic" value={p.brief.chronic} />
              <BriefLine label="Compliance" value={p.brief.compliance} />
              <BriefLine label="Probe today" value={p.brief.probe} />
              <BriefLine label="Pending" value={p.brief.pending} />
            </div>
          ) : (
            <SkeletonBrief />
          )}

          <div
            style={{
              padding: "16px 24px",
              borderTop: `1px solid ${C.borderSoft}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Link href={`/consult?pid=${encodeURIComponent(p.id)}`} style={{ display: "inline-flex" }}>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: C.text,
                  borderBottom: `1px solid ${C.text}`,
                  paddingBottom: 1,
                  letterSpacing: 0.1,
                }}
              >
                Start consult →
              </span>
            </Link>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11.5, color: C.hint, fontFamily: FONT_MONO }}>
              {p.ownerPhone}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Right agenda column widgets                                        */
/* ------------------------------------------------------------------ */

function AgendaCard({
  title,
  children,
  delay,
}: {
  title: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 12,
        animation: "fadeUp 480ms ease both",
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.borderSoft}`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function QuickActions({ onAddPatient }: { onAddPatient: () => void }) {
  const actions = [
    { label: "Add new patient", onClick: onAddPatient },
    { label: "Open consult", href: "/consult" },
    { label: "Review follow-ups", href: "/follow-ups" },
    { label: "Pet passports", href: "/passport" },
  ];
  return (
    <AgendaCard title="Quick actions" delay={220}>
      <div style={{ display: "grid", gap: 8 }}>
        {actions.map((a) => (
          a.href ? (
            <Link
              key={a.label}
              href={a.href}
              style={{ textDecoration: "none" }}
            >
              <QuickActionRow label={a.label} />
            </Link>
          ) : (
            <div
              key={a.label}
              onClick={a.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  a.onClick?.();
                }
              }}
            >
              <QuickActionRow label={a.label} />
            </div>
          )
        ))}
      </div>
    </AgendaCard>
  );
}

function QuickActionRow({ label }: { label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "12px 14px",
        border: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: 500,
        color: C.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: C.card,
        transition: "border-color 160ms ease, transform 140ms ease",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        cursor: "pointer",
      }}
    >
      <span>{label}</span>
      <span style={{ color: C.muted, fontSize: 13 }}>→</span>
    </div>
  );
}

const RECENT_ACTIVITY = [
  { time: "10:12", text: "Rex — SOAP approved" },
  { time: "09:48", text: "Milo — escalation opened" },
  { time: "09:21", text: "Tofu — follow-up auto-resolved" },
  { time: "08:57", text: "Luna — intake consult started" },
  { time: "08:30", text: "Clinic day opened" },
];

function RecentActivity() {
  return (
    <AgendaCard title="Recent activity" delay={300}>
      <div style={{ display: "grid", gap: 10 }}>
        {RECENT_ACTIVITY.map((a) => (
          <div
            key={a.time + a.text}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              fontSize: 13,
              color: C.text,
            }}
          >
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11.5,
                color: C.muted,
                minWidth: 40,
              }}
            >
              {a.time}
            </span>
            <span style={{ color: C.hint }}>·</span>
            <span style={{ color: C.ink, lineHeight: 1.45 }}>{a.text}</span>
          </div>
        ))}
      </div>
    </AgendaCard>
  );
}

function FollowUpSummary({
  escalations,
  monitors,
  resolved,
}: {
  escalations: number;
  monitors: number;
  resolved: number;
}) {
  return (
    <AgendaCard title="Follow-up queue" delay={380}>
      <div style={{ display: "grid", gap: 12 }}>
        <SummaryRow color={C.red} label="Escalations" count={escalations} />
        <SummaryRow color={C.amber} label="Monitor" count={monitors} />
        <SummaryRow color={C.green} label="Recovered" count={resolved} />
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${C.borderSoft}`,
        }}
      >
        <Link href="/follow-ups" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              borderBottom: `1px solid ${C.text}`,
              paddingBottom: 1,
              letterSpacing: 0.1,
            }}
          >
            View all →
          </span>
        </Link>
      </div>
    </AgendaCard>
  );
}

function SummaryRow({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Dot color={color} size={8} />
      <span style={{ fontSize: 13.5, color: C.text, flex: 1 }}>{label}</span>
      <span
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 20,
          fontWeight: 500,
          color: C.text,
          letterSpacing: -0.4,
        }}
      >
        {count}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section label                                                      */
/* ------------------------------------------------------------------ */

function SectionLabel({
  title,
  count,
  suffix,
}: {
  title: string;
  count?: string | number;
  suffix?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        marginBottom: 18,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.6,
          color: C.text,
        }}
      >
        {title}
      </h3>
      {count != null && (
        <span
          style={{
            fontSize: 11,
            fontFamily: FONT_MONO,
            color: C.muted,
            border: `1px solid ${C.borderSoft}`,
            padding: "2px 8px",
            borderRadius: 999,
            background: C.bgAlt,
          }}
        >
          {count}
          {suffix ? ` ${suffix}` : ""}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const {
    followups,
    patients,
    metrics,
    resolvedCount,
    loading,
    error,
    refresh,
    expandedPatient,
    setExpandedPatient,
    flashToast,
  } = useStore();

  const escalations = followups.filter((f) => f.level === "escalate");
  const monitors = followups.filter((f) => f.level === "monitor");
  const [isAddModalOpen, setAddModalOpen] = useState(false);

  return (
    <div style={{ padding: "0 32px 120px", maxWidth: 1320, margin: "0 auto" }}>
      <HeroRow escalationCount={escalations.length} />

      {error && <ErrorBanner error={error} onRetry={() => void refresh()} />}

      {isAddModalOpen && <AddPatientModal onClose={() => setAddModalOpen(false)} />}

      <KpiRow metrics={metrics} loading={loading} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* ---------- Left: Today's Schedule ---------- */}
        <div>
          <SectionLabel
            title="Today's Schedule"
            count={
              loading && patients.length === 0
                ? "loading…"
                : `${patients.length} patients`
            }
          />
          <div style={{ display: "grid", gap: 10 }}>
            {loading && patients.length === 0
              ? [0, 1, 2, 3, 4].map((i) => (
                  <SkeletonPatientRow key={i} index={i} />
                ))
              : patients.map((p, i) => (
                  <PatientRow
                    key={p.id}
                    p={p}
                    index={i}
                    expanded={expandedPatient === p.id}
                    onToggle={() =>
                      setExpandedPatient(expandedPatient === p.id ? null : p.id)
                    }
                  />
                ))}
          </div>
        </div>

        {/* ---------- Right: Agenda & Widgets ---------- */}
        <div style={{ display: "grid", gap: 24, position: "sticky", top: 32 }}>
          <QuickActions onAddPatient={() => setAddModalOpen(true)} />
          <RecentActivity />
          <FollowUpSummary
            escalations={escalations.length}
            monitors={monitors.length}
            resolved={resolvedCount}
          />
        </div>
      </div>
    </div>
  );
}
