"use client";

import { useState } from "react";
import { Button, Dot } from "@/components/atoms";
import { PageHeader } from "@/components/app-shell/page-header";
import { useStore } from "@/components/app-shell/store";
import { SkeletonEscalationCard } from "@/components/app-shell/skeleton";
import { ErrorBanner } from "@/components/app-shell/error-banner";
import { C, FONT_SERIF, FONT_MONO } from "@/lib/tokens";
import type { FollowUp } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Filter tabs                                                        */
/* ------------------------------------------------------------------ */

type Filter = "all" | "escalate" | "monitor" | "clear";

/**
 * Small chip surfacing how many owner-attached photos are in this
 * followup's conversation. Walks `f.conversation`, sums photoUrls across
 * all owner turns, and renders a thumbnail strip + count chip. Returns
 * null when there are no photos so the layout stays unchanged for
 * text-only follow-ups.
 */
function PhotoChip({ f }: { f: FollowUp }) {
  const turns = f.conversation ?? [];
  const photos: string[] = [];
  for (const t of turns) {
    if (t.role === "owner" && t.photoUrls) photos.push(...t.photoUrls);
  }
  if (photos.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: -8,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: C.muted,
          border: `1px solid ${C.border}`,
          borderRadius: 999,
          background: "#fff",
        }}
      >
        📷 {photos.length} photo{photos.length === 1 ? "" : "s"} attached
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {photos.slice(0, 3).map((url, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={`${url}-${i}`}
            src={url}
            alt={`Owner photo ${i + 1}`}
            style={{
              width: 32,
              height: 32,
              objectFit: "cover",
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              background: "#fff",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FilterTabs({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  counts: Record<Filter, number>;
}) {
  const tabs: Array<{ id: Filter; label: string; color?: string }> = [
    { id: "all", label: "All" },
    { id: "escalate", label: "Escalations", color: C.red },
    { id: "monitor", label: "Monitor", color: C.amber },
    { id: "clear", label: "Recovered", color: C.green },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${active ? C.text : C.borderSoft}`,
              background: active ? C.text : C.card,
              color: active ? "#FFFFFF" : C.text,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.1,
              cursor: "pointer",
              transition: "border-color 140ms ease, background 140ms ease",
            }}
          >
            {t.color && <Dot color={active ? "#FFFFFF" : t.color} size={7} />}
            <span>{t.label}</span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: active ? "rgba(255,255,255,0.75)" : C.muted,
              }}
            >
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Queue cards                                                        */
/* ------------------------------------------------------------------ */

function EscalationCard({
  f,
  onReview,
  index,
}: {
  f: FollowUp;
  onReview: () => void;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const { changeFollowUpLevel } = useStore();
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.card,
        borderTop: `1px solid ${hover ? C.red : C.borderSoft}`,
        borderRight: `1px solid ${hover ? C.red : C.borderSoft}`,
        borderBottom: `1px solid ${hover ? C.red : C.borderSoft}`,
        borderLeft: `2px solid ${C.red}`,
        borderRadius: 12,
        padding: "20px 22px",
        minHeight: 110,
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 140ms ease, border-color 160ms ease",
        animation: "fadeUp 440ms ease both",
        animationDelay: `${120 + index * 50}ms`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Dot color={C.red} size={8} pulsing />
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 17,
            fontWeight: 500,
            color: C.text,
            letterSpacing: -0.2,
          }}
        >
          {f.patient}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
          · {f.procedure}
        </div>
        <div style={{ flex: 1 }} />
        {f.tsLabel && (
          <div
            style={{
              fontSize: 11.5,
              color: C.hint,
              fontFamily: FONT_MONO,
            }}
          >
            {f.tsLabel}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 14,
          fontStyle: "italic",
          color: C.ink,
          lineHeight: 1.55,
          marginBottom: 14,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        &ldquo;{f.ownerMessage}&rdquo;
      </div>

      <PhotoChip f={f} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: C.muted }}>{f.owner}</div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={() => changeFollowUpLevel(f, "monitor")}>
          Monitor
        </Button>
        <Button size="sm" variant="ghost" onClick={() => changeFollowUpLevel(f, "clear")}>
          Recovered
        </Button>
        <Button size="sm" variant="primary" onClick={onReview}>
          Review
        </Button>
      </div>
    </div>
  );
}

function MonitorCard({ f, index }: { f: FollowUp; index: number }) {
  const [hover, setHover] = useState(false);
  const { changeFollowUpLevel } = useStore();
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.card,
        borderTop: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderRight: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderBottom: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderLeft: `2px solid ${C.amber}`,
        borderRadius: 12,
        padding: "20px 22px",
        minHeight: 100,
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 140ms ease, border-color 160ms ease",
        animation: "fadeUp 440ms ease both",
        animationDelay: `${120 + index * 50}ms`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Dot color={C.amber} size={8} />
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 17,
            fontWeight: 500,
            color: C.text,
            letterSpacing: -0.2,
          }}
        >
          {f.patient}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
          · {f.procedure}
        </div>
        <div style={{ flex: 1 }} />
        {f.tsLabel && (
          <div
            style={{
              fontSize: 11.5,
              color: C.hint,
              fontFamily: FONT_MONO,
            }}
          >
            {f.tsLabel}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 14,
          fontStyle: "italic",
          color: C.ink,
          lineHeight: 1.55,
          marginBottom: 12,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        &ldquo;{f.ownerMessage}&rdquo;
      </div>

      <PhotoChip f={f} />

      <div
        style={{
          fontSize: 12.5,
          color: C.muted,
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: C.ink, fontWeight: 600 }}>Recommendation · </span>
        {f.recommendation}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: C.muted }}>{f.owner}</div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={() => changeFollowUpLevel(f, "escalate")}>
          Escalate
        </Button>
        <Button size="sm" variant="ghost" onClick={() => changeFollowUpLevel(f, "clear")}>
          Recovered
        </Button>
      </div>
    </div>
  );
}

function ClearCard({ f, index }: { f: FollowUp; index: number }) {
  const [hover, setHover] = useState(false);
  const { approveClear, changeFollowUpLevel } = useStore();

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.card,
        borderTop: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderRight: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderBottom: `1px solid ${hover ? C.border : C.borderSoft}`,
        borderLeft: `2px solid ${C.green}`,
        borderRadius: 12,
        padding: "20px 22px",
        minHeight: 100,
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 140ms ease, border-color 160ms ease",
        animation: "fadeUp 440ms ease both",
        animationDelay: `${120 + index * 50}ms`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Dot color={C.green} size={8} />
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 17,
            fontWeight: 500,
            color: C.text,
            letterSpacing: -0.2,
          }}
        >
          {f.patient}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
          · {f.procedure}
        </div>
        <div style={{ flex: 1 }} />
        {f.tsLabel && (
          <div
            style={{
              fontSize: 11.5,
              color: C.hint,
              fontFamily: FONT_MONO,
            }}
          >
            {f.tsLabel}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 14,
          fontStyle: "italic",
          color: C.ink,
          lineHeight: 1.55,
          marginBottom: 12,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        &ldquo;{f.ownerMessage}&rdquo;
      </div>

      <PhotoChip f={f} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: C.muted }}>Pending Approval · {f.owner}</div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={() => changeFollowUpLevel(f, "escalate")}>
          Escalate
        </Button>
        <Button size="sm" variant="ghost" onClick={() => changeFollowUpLevel(f, "monitor")}>
          Monitor
        </Button>
        <Button size="sm" variant="primary" onClick={() => approveClear(f)}>
          Approve
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

const EMPTY_COPY: Record<Filter, { title: string; sub: string }> = {
  all: {
    title: "Nothing in the queue",
    sub: "No escalations, monitors or recoveries logged yet.",
  },
  escalate: {
    title: "No escalations — nice.",
    sub: "Everyone's recovering on track. We'll ping you if that changes.",
  },
  monitor: {
    title: "Nothing to monitor",
    sub: "No ambiguous replies waiting on your call.",
  },
  clear: {
    title: "No recoveries yet",
    sub: "All-clear cases will appear here as they close automatically.",
  },
};

function EmptyState({ filter }: { filter: Filter }) {
  const copy = EMPTY_COPY[filter];
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 12,
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 20,
          fontWeight: 500,
          color: C.text,
          letterSpacing: -0.3,
          marginBottom: 8,
        }}
      >
        {copy.title}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: C.muted,
          maxWidth: 380,
          margin: "0 auto",
          lineHeight: 1.5,
        }}
      >
        {copy.sub}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FollowUpsPage() {
  const { followups, resolvedCount, openEscalation, loading, error, refresh } =
    useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const showSkeleton = loading && followups.length === 0;

  const escalations = followups.filter((f) => f.level === "escalate");
  const monitors = followups.filter((f) => f.level === "monitor");
  const clears = followups.filter((f) => f.level === "clear");

  const counts: Record<Filter, number> = {
    all: followups.length,
    escalate: escalations.length,
    monitor: monitors.length,
    clear: clears.length, // show doctor-facing pending approvals count
  };

  return (
    <div style={{ padding: "0 32px 120px", maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Queue"
        title="Follow-ups"
        sub="24–48h post-visit check-ins. Escalate only what needs you."
      />

      {error && <ErrorBanner error={error} onRetry={() => void refresh()} />}

      <FilterTabs value={filter} onChange={setFilter} counts={counts} />

      {showSkeleton && (
        <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonEscalationCard key={i} index={i} />
          ))}
        </div>
      )}

      {/* Escalations section */}
      {!showSkeleton && (filter === "all" || filter === "escalate") && (
        <div style={{ marginBottom: filter === "all" ? 32 : 0 }}>
          {filter === "all" && (
            <SectionHeading
              title="Escalations"
              color={C.red}
              count={escalations.length}
            />
          )}
          {escalations.length === 0 ? (
            filter === "escalate" && <EmptyState filter="escalate" />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {escalations.map((f, i) => (
                <EscalationCard
                  key={f.id}
                  f={f}
                  index={i}
                  onReview={() => openEscalation(f)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monitor section */}
      {!showSkeleton && (filter === "all" || filter === "monitor") && (
        <div style={{ marginBottom: filter === "all" ? 32 : 0 }}>
          {filter === "all" && (
            <SectionHeading
              title="Monitor"
              color={C.amber}
              count={monitors.length}
            />
          )}
          {monitors.length === 0 ? (
            filter === "monitor" && <EmptyState filter="monitor" />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {monitors.map((f, i) => (
                <MonitorCard key={f.id} f={f} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recovered section */}
      {!showSkeleton && (filter === "all" || filter === "clear") && (
        <div>
          {filter === "all" && (
            <SectionHeading
              title="Recovered"
              color={C.green}
              count={clears.length}
            />
          )}
          {filter === "clear" && clears.length === 0 && resolvedCount === 0 && (
            <EmptyState filter="clear" />
          )}
          {filter === "clear" && resolvedCount > 0 && (
            <div style={{ marginBottom: clears.length > 0 ? 16 : 0 }}>
              <RecoveredSummary resolvedCount={resolvedCount} />
            </div>
          )}
          {clears.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {clears.map((f, i) => (
                <ClearCard key={f.id} f={f} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function SectionHeading({
  title,
  color,
  count,
}: {
  title: string;
  color: string;
  count: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <Dot color={color} size={7} />
      <h3
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: C.text,
        }}
      >
        {title}
      </h3>
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
      </span>
    </div>
  );
}

function RecoveredSummary({ resolvedCount }: { resolvedCount: number }) {
  return (
    <div
      style={{
        background: C.card,
        borderTop: `1px solid ${C.borderSoft}`,
        borderRight: `1px solid ${C.borderSoft}`,
        borderBottom: `1px solid ${C.borderSoft}`,
        borderLeft: `2px solid ${C.green}`,
        borderRadius: 12,
        padding: "22px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        animation: "fadeUp 440ms ease both",
      }}
    >
      <Dot color={C.green} size={9} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 22,
            fontWeight: 500,
            color: C.text,
            letterSpacing: -0.4,
          }}
        >
          {resolvedCount} cases approved this week
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          All-clear replies closed and verified · no action needed
        </div>
      </div>
    </div>
  );
}
