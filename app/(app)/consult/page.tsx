"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useMemo, useRef, useState } from "react";
import { Button, Card, Icon, Pill } from "@/components/atoms";
import { PageHeader, PetAvatar } from "@/components/app-shell/page-header";
import { useStore } from "@/components/app-shell/store";
import { StreamedText } from "@/components/app-shell/streamed-text";
import { api } from "@/lib/api";
import { C, FONT_MONO, FONT_SERIF, SHADOW_CARD } from "@/lib/tokens";
import type {
  BillingItem,
  ConsultOutput,
  PrescriptionItem,
  SoapNote,
  TodoItem,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────
// Demo scenarios — paste-in templates (PRD §F2 fidelity)
// ─────────────────────────────────────────────────────────────────────
const SCENARIOS: { id: string; label: string; blurb: string; text: string }[] = [
  {
    id: "ccl",
    label: "CCL partial tear (Milo)",
    blurb: "Right hind limp, 2wk · canonical F2 example",
    text:
      "Came in for limping on right hind for past 2 weeks. Worse on stairs. No trauma witnessed. " +
      "Palpated right stifle — pain response, mild joint effusion. Positive cranial drawer, partial. " +
      "Doing rads today, lateral + caudocranial. Send home with Meloxicam 0.1mg/kg SID x7d, gabapentin for comfort. " +
      "E-collar. Strict rest 14 days. Recheck in 7.",
  },
  {
    id: "otitis",
    label: "Otitis recheck (Luna)",
    blurb: "Ear canal still inflamed · R ear",
    text:
      "Recheck right ear post Otomax course. Canal still mildly erythematous, minimal debris, no odor. " +
      "Cytology clean. Continue cleaning wipes twice weekly, stop Otomax. Owner wants annual vaccines today — DHPP + Lepto due. " +
      "Also discussed dental — owner declining again.",
  },
  {
    id: "gi",
    label: "Acute GI (Biscuit)",
    blurb: "Vomiting + soft stool · 2 days",
    text:
      "2-day history of vomiting (3x yesterday) and soft stool. Still drinking, appetite reduced. " +
      "No dietary indiscretion reported. Abdomen soft, non-painful. BW stable. Temp 38.9. " +
      "Start bland diet 5 days, metronidazole 15mg/kg BID x5d, probiotic sachet. " +
      "Recheck if not improved in 48h. Fecal float recommended.",
  },
];

// ─────────────────────────────────────────────────────────────────────
// Reusable card shell — flat, hairline, editorial
// ─────────────────────────────────────────────────────────────────────
function OutputCardShell({
  title,
  meta,
  accent,
  children,
  footer,
  delay = 0,
}: {
  title: string;
  meta?: ReactNode;
  accent?: "amber";
  children: ReactNode;
  footer?: ReactNode;
  delay?: number;
}) {
  return (
    <Card
      style={{
        padding: 0,
        overflow: "hidden",
        boxShadow: SHADOW_CARD,
        borderLeft:
          accent === "amber"
            ? `2px solid ${C.amberBorder}`
            : `1px solid ${C.border}`,
        animation: `slideIn 420ms ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h3
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.2,
            margin: 0,
            color: C.text,
          }}
        >
          {title}
        </h3>
        {meta && (
          <div style={{ fontSize: 11, color: C.hint, letterSpacing: 0.3 }}>
            {meta}
          </div>
        )}
      </div>
      <div style={{ padding: "18px 20px" }}>{children}</div>
      {footer && (
        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.bgAlt,
          }}
        >
          {footer}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SOAP
// ─────────────────────────────────────────────────────────────────────
function SoapCard({ s, onApprove }: { s: SoapNote; onApprove: () => void }) {
  const rows: { k: "S" | "O" | "A" | "P"; v: string }[] = [
    { k: "S", v: s.S },
    { k: "O", v: s.O },
    { k: "A", v: s.A },
    { k: "P", v: s.P },
  ];
  return (
    <OutputCardShell
      title="SOAP note"
      meta="auto-extracted"
      delay={0}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon={Icon.edit(13)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" icon={Icon.check(13)} onClick={onApprove}>
            Approve
          </Button>
        </>
      }
    >
      {rows.map((r, i) => (
        <div
          key={r.k}
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr",
            gap: 14,
            padding: "10px 0",
            borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none",
          }}
        >
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: 0.5,
              display: "inline-grid",
              placeItems: "center",
              width: 24,
              height: 22,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              background: "#fff",
            }}
          >
            {r.k}
          </span>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text }}>
            <StreamedText
              text={r.v}
              chunkSize={2}
              intervalMs={35}
              startDelayMs={220 + i * 180}
            />
          </div>
        </div>
      ))}
    </OutputCardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Prescription
// ─────────────────────────────────────────────────────────────────────
function PrescriptionCard({
  rx,
  onApprove,
}: {
  rx: PrescriptionItem[];
  onApprove: () => void;
}) {
  return (
    <OutputCardShell
      title="Prescription"
      meta={`${rx.length} drug${rx.length === 1 ? "" : "s"}`}
      delay={90}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon={Icon.edit(13)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" icon={Icon.check(13)} onClick={onApprove}>
            Approve
          </Button>
        </>
      }
    >
      {rx.map((r, i) => (
        <div
          key={i}
          style={{
            padding: "12px 0",
            borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none",
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13.5,
              fontWeight: 700,
              color: C.text,
              letterSpacing: -0.1,
            }}
          >
            {r.drug}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginTop: 8,
            }}
          >
            {[
              { k: "Dose", v: r.dose },
              { k: "Duration", v: r.dur },
              { k: "Qty", v: r.qty },
            ].map((f) => (
              <div key={f.k}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: C.hint,
                    fontWeight: 600,
                  }}
                >
                  {f.k}
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12.5,
                    color: C.text,
                    marginTop: 3,
                  }}
                >
                  {f.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </OutputCardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Billing
// ─────────────────────────────────────────────────────────────────────
function BillingCard({
  items,
  total,
  flagged,
  onApprove,
}: {
  items: BillingItem[];
  total: number;
  flagged: number;
  onApprove: () => void;
}) {
  return (
    <OutputCardShell
      title="Billing recovery"
      meta={`${items.length} items`}
      delay={180}
      footer={
        <>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 18,
              fontWeight: 600,
              color: C.text,
              letterSpacing: -0.2,
            }}
          >
            Total{" "}
            <span style={{ fontFamily: FONT_MONO, fontSize: 15 }}>
              RM {total}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon={Icon.edit(13)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" icon={Icon.check(13)} onClick={onApprove}>
            Approve
          </Button>
        </>
      }
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "18px 1fr auto",
            gap: 12,
            alignItems: "start",
            padding: "10px 12px",
            marginLeft: -8,
            marginRight: -8,
            marginBottom: 2,
            borderRadius: 8,
            borderLeft: it.flagged
              ? `2px solid ${C.amber}`
              : `2px solid transparent`,
            background: "transparent",
          }}
        >
          <span
            style={{
              color: it.flagged ? C.amber : C.green,
              display: "inline-flex",
              marginTop: 2,
            }}
          >
            {it.flagged ? Icon.warn(14) : Icon.check(14)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                color: C.text,
                fontWeight: it.flagged ? 600 : 500,
              }}
            >
              {it.item}
            </div>
            {it.flagged && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 5,
                  padding: "2px 8px",
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  color: C.amber,
                  border: `1px solid ${C.amberBorder}`,
                  borderRadius: 999,
                  background: "transparent",
                }}
              >
                {Icon.warn(10)} In notes, not yet billed
              </div>
            )}
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              whiteSpace: "nowrap",
            }}
          >
            RM {it.price}
          </div>
        </div>
      ))}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${C.borderSoft}`,
          fontSize: 11,
          color: C.hint,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        Impact: 10% billing recovery × 400 consults/month × RM 250 avg = RM
        10,000/month recovered.
      </div>
      <div style={{ display: "none" }}>{flagged}</div>
    </OutputCardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Todos
// ─────────────────────────────────────────────────────────────────────
function TodoCard({ todos, onApprove }: { todos: TodoItem[]; onApprove: () => void }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const assigneeTone = (who: string): "green" | "amber" | "neutral" => {
    const w = who.toLowerCase();
    if (w.includes("vet") || w.includes("doctor")) return "green";
    if (w.includes("nurse")) return "amber";
    return "neutral";
  };
  return (
    <OutputCardShell
      title="Staff to-do"
      meta={`${todos.length} tasks`}
      delay={270}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon={Icon.check(13)} onClick={onApprove}>
            Approve
          </Button>
        </>
      }
    >
      {todos.map((t, i) => (
        <div
          key={i}
          onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 0",
            cursor: "pointer",
            borderTop: i > 0 ? `1px solid ${C.borderSoft}` : "none",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: `1.5px solid ${done[i] ? C.green : C.border}`,
              background: done[i] ? C.green : "transparent",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              transition: "all 140ms ease",
            }}
          >
            {done[i] && Icon.check(11)}
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 13.5,
              color: done[i] ? C.muted : C.text,
              textDecoration: done[i] ? "line-through" : "none",
              lineHeight: 1.4,
            }}
          >
            {t.task}
          </div>
          <Pill tone={assigneeTone(t.who)} style={{ fontSize: 11, padding: "2px 9px" }}>
            {t.who}
          </Pill>
        </div>
      ))}
    </OutputCardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Calm generating indicator — hairline marquee, no gradients
// ─────────────────────────────────────────────────────────────────────
function GeneratingMarquee() {
  return (
    <div
      style={{
        position: "relative",
        height: 2,
        background: C.borderSoft,
        borderRadius: 999,
        overflow: "hidden",
        marginTop: 14,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "30%",
          background: C.text,
          animation: "marquee 1.4s linear infinite",
          borderRadius: 999,
        }}
      />
    </div>
  );
}

function DotPulse() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: C.muted,
            animation: "pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 160}ms`,
            display: "inline-block",
          }}
        />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Status pill (flat, hairline)
// ─────────────────────────────────────────────────────────────────────
function StatusPill({
  state,
}: {
  state: "idle" | "generating" | "ready";
}) {
  const map = {
    idle: { label: "Awaiting input", tone: "neutral" as const, dotColor: C.hint },
    generating: {
      label: "Generating",
      tone: "neutral" as const,
      dotColor: C.muted,
    },
    ready: {
      label: "Ready — review & approve",
      tone: "green" as const,
      dotColor: C.green,
    },
  };
  const v = map[state];
  return (
    <Pill tone={v.tone} style={{ fontSize: 11.5 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: v.dotColor,
          display: "inline-block",
          animation: state === "generating" ? "pulse 1.2s ease-in-out infinite" : "none",
        }}
      />
      {v.label}
      {state === "generating" && (
        <span style={{ marginLeft: 4 }}>
          <DotPulse />
        </span>
      )}
    </Pill>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Example scenarios dropdown
// ─────────────────────────────────────────────────────────────────────
function ExampleDropdown({ onPick }: { onPick: (text: string, label: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 8,
          background: "#fff",
          border: `1px solid ${C.border}`,
          color: C.text,
          fontSize: 12.5,
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: "pointer",
          letterSpacing: 0.1,
        }}
      >
        Example scenarios {Icon.chevron(12, open ? "up" : "down")}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 280,
            background: "#fff",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: SHADOW_CARD,
            padding: 4,
            zIndex: 20,
            animation: "slideIn 180ms ease both",
          }}
        >
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                onPick(sc.text, sc.label);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bgAlt)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                {sc.label}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                {sc.blurb}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
function ConsultContent() {
  const params = useSearchParams();
  const pid = params.get("pid");
  const { flashToast, patients } = useStore();
  const patient = patients.find((p) => p.id === pid) || patients[0];

  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<ConsultOutput | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const billTotal = useMemo(
    () => (output ? output.billing.reduce((a, b) => a + b.price, 0) : 0),
    [output]
  );
  const billFlagged = useMemo(
    () =>
      output
        ? output.billing.filter((b) => b.flagged).reduce((a, b) => a + b.price, 0)
        : 0,
    [output]
  );

  const generate = async () => {
    if (!notes.trim() || !patient) return;
    setGenerating(true);
    setOutput(null);
    try {
      const res = await api.consult({ patientId: patient.id, notes });
      setOutput(res.output);
      const flagged = res.output.billing
        .filter((b) => b.flagged)
        .reduce((a, b) => a + b.price, 0);
      flashToast(
        flagged > 0
          ? `Extracted · ${res.output.billing.length} billing items · RM ${flagged} recoverable`
          : `Extracted · SOAP + ${res.output.prescription.length} rx + ${res.output.todos.length} todos`,
      );
    } catch (err) {
      flashToast(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const toggleRecord = () => {
    if (recording) {
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = null;
      setRecording(false);
      setRecordSec(0);
    } else {
      setRecording(true);
      setRecordSec(0);
      recordTimer.current = setInterval(() => {
        setRecordSec((s) => s + 1);
      }, 1000);
    }
  };

  const pickExample = (text: string, label: string) => {
    setNotes(text);
    flashToast(`Example loaded · ${label}`);
  };

  const status: "idle" | "generating" | "ready" = generating
    ? "generating"
    : output
    ? "ready"
    : "idle";

  const fmtTime = (n: number) =>
    `${Math.floor(n / 60)}:${(n % 60).toString().padStart(2, "0")}`;

  if (!patient) {
    return (
      <div style={{ padding: 48, color: C.muted, fontSize: 14 }}>
        Loading patient…
      </div>
    );
  }

  return (
    <div style={{ padding: "0 32px 120px", maxWidth: 1480, margin: "0 auto" }}>
      {/* Patient context bar */}
      <PageHeader
        eyebrow="Consultation"
        title="Capture today's visit."
        sub={`Dr. Amirah · PawsClinic KL · ${new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`}
        right={
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon={Icon.back(14)}>
              Dashboard
            </Button>
          </Link>
        }
      />

      {/* Patient strip + probe */}
      <Card
        style={{
          padding: 0,
          marginBottom: 28,
          overflow: "hidden",
          boxShadow: SHADOW_CARD,
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <PetAvatar name={patient.name} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 22,
                fontWeight: 600,
                color: C.text,
                letterSpacing: -0.4,
                lineHeight: 1.1,
              }}
            >
              {patient.name}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: C.muted,
                marginTop: 3,
              }}
            >
              {patient.species} · {patient.breed} · {patient.age} · {patient.sex}
            </div>
          </div>
          <div
            style={{
              height: 28,
              width: 1,
              background: C.border,
              margin: "0 4px",
            }}
          />
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                color: C.hint,
                fontWeight: 600,
              }}
            >
              Owner
            </div>
            <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>
              {patient.owner}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Pill tone={patient.tagColor}>{patient.tag}</Pill>
          <Link href="/dashboard">
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: C.muted,
                fontSize: 12.5,
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "6px 2px",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Switch patient
            </button>
          </Link>
        </div>
        {/* Probe reminder row — quiet muted bar */}
        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: "10px 20px",
            background: C.bgAlt,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12.5,
            color: C.muted,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: C.green,
            }}
          >
            Probe today
          </span>
          <span style={{ color: C.border }}>·</span>
          <span style={{ color: C.text, fontWeight: 500 }}>
            {patient.brief.probe}
          </span>
        </div>
      </Card>

      {/* Two-column working area */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 45fr) minmax(0, 55fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT — input */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: -0.3,
                margin: 0,
                color: C.text,
              }}
            >
              Consultation notes
            </h3>
            <div style={{ flex: 1 }} />
            <ExampleDropdown onPick={pickExample} />
          </div>

          <Card
            style={{
              padding: 0,
              overflow: "hidden",
              boxShadow: SHADOW_CARD,
            }}
          >
            {/* Mic bar */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={toggleRecord}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 8,
                  background: recording ? "#fff" : "#fff",
                  border: `1px solid ${recording ? C.redBorder : C.border}`,
                  color: recording ? C.red : C.text,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {recording ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: C.red,
                      animation: "pulse 1.2s ease-in-out infinite",
                      display: "inline-block",
                    }}
                  />
                ) : (
                  Icon.mic(13)
                )}
                {recording ? `Recording ${fmtTime(recordSec)}` : "Record voice"}
              </button>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontSize: 11,
                  color: C.hint,
                  letterSpacing: 0.3,
                }}
              >
                {notes.length} chars
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dictate or type consultation notes…"
              style={{
                width: "100%",
                minHeight: 320,
                resize: "vertical",
                padding: "20px 22px",
                border: "none",
                outline: "none",
                fontSize: 14.5,
                lineHeight: 1.65,
                color: C.text,
                fontFamily: "inherit",
                background: "#fff",
                display: "block",
                boxSizing: "border-box",
              }}
            />
          </Card>

          {/* CTA row */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: C.hint,
                lineHeight: 1.4,
                flex: 1,
              }}
            >
              Consilium cross-references your notes against the clinic billing
              matrix and past visits.
            </div>
            {notes && (
              <Button variant="ghost" size="sm" onClick={() => setNotes("")}>
                Clear
              </Button>
            )}
            <Button
              size="md"
              onClick={generate}
              icon={Icon.spark(14)}
              style={
                !notes.trim() || generating
                  ? { opacity: 0.45, pointerEvents: "none" }
                  : undefined
              }
            >
              {generating
                ? "Generating…"
                : output
                ? "Regenerate structured output"
                : "Generate structured output"}
            </Button>
          </div>
          {generating && <GeneratingMarquee />}
        </div>

        {/* RIGHT — output */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: -0.3,
                margin: 0,
                color: C.text,
              }}
            >
              Structured output
            </h3>
            <div style={{ flex: 1 }} />
            <StatusPill state={status} />
          </div>

          {status === "idle" && (
            <Card
              style={{
                padding: "56px 28px",
                textAlign: "center",
                boxShadow: SHADOW_CARD,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  margin: "0 auto 14px",
                  border: `1px solid ${C.border}`,
                  display: "grid",
                  placeItems: "center",
                  color: C.muted,
                  background: "#fff",
                }}
              >
                {Icon.spark(18)}
              </div>
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: -0.2,
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                Awaiting notes
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: C.muted,
                  maxWidth: 380,
                  margin: "0 auto",
                  lineHeight: 1.55,
                }}
              >
                Paste or dictate a consult, then press{" "}
                <b style={{ color: C.text }}>Generate</b>. SOAP, prescription,
                billing recovery, and staff to-dos appear here.
              </div>
            </Card>
          )}

          {status === "generating" && (
            <Card
              style={{
                padding: "44px 28px",
                boxShadow: SHADOW_CARD,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                Reading consultation notes
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
                Extracting SOAP · cross-referencing billing · drafting to-dos{" "}
                <DotPulse />
              </div>
              <div style={{ maxWidth: 280, margin: "0 auto" }}>
                <GeneratingMarquee />
              </div>
            </Card>
          )}

          {status === "ready" && output && (
            <div style={{ display: "grid", gap: 14 }}>
              <SoapCard
                s={output.soap}
                onApprove={() => flashToast("SOAP note approved")}
              />
              <PrescriptionCard
                rx={output.prescription}
                onApprove={() =>
                  flashToast("Prescription approved · queued for dispensing")
                }
              />

              {/* Recoverable callout — thin amber border, no wash */}
              {billFlagged > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${C.amberBorder}`,
                    background: "transparent",
                    color: C.amber,
                    fontSize: 12.5,
                    fontWeight: 600,
                    alignSelf: "flex-start",
                    width: "fit-content",
                    animation: "slideIn 380ms ease both",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: C.amber,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontFamily: FONT_MONO }}>RM {billFlagged}</span>{" "}
                  recoverable — 2 items flagged in notes, not yet billed
                </div>
              )}

              <BillingCard
                items={output.billing}
                total={billTotal}
                flagged={billFlagged}
                onApprove={() =>
                  flashToast(`Billing approved · RM ${billFlagged} recovered`)
                }
              />
              <TodoCard
                todos={output.todos}
                onApprove={() => flashToast("Staff to-dos dispatched")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConsultPage() {
  return (
    <Suspense>
      <ConsultContent />
    </Suspense>
  );
}
