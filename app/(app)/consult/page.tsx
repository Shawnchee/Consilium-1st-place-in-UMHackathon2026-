"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, Icon, Pill } from "@/components/atoms";
import { PageHeader, PetAvatar } from "@/components/app-shell/page-header";
import { useStore } from "@/components/app-shell/store";
import { StreamedText } from "@/components/app-shell/streamed-text";
import {
  ArchitectureDiagram,
  SendPanel,
  TavilyFeed,
  Timeline,
  useCaptureStream,
} from "@/components/agent-team";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/app-shell/skeleton";
import { C, FONT_MONO, FONT_SERIF, SHADOW_CARD } from "@/lib/tokens";
import type {
  BillingItem,
  ConsultOutput,
  Patient,
  PrescriptionItem,
  SoapNote,
  TodoItem,
} from "@/lib/types";
import { CLINIC } from "@/lib/clinic";

// ─────────────────────────────────────────────────────────────────────
// Demo scenarios — paste-in templates (PRD §F2 fidelity)
// ─────────────────────────────────────────────────────────────────────
const SCENARIOS: { id: string; label: string; blurb: string; text: string }[] = [
  {
    id: "leo-uro",
    label: "Urinary obstruction (Leo, demo)",
    blurb: "Stranguria + struvite crystals · explicit Rx for demo",
    text:
      "T 38.7°C, HR 105, BAR. BW 22kg. Bladder firm + tender on palpation. " +
      "Penile exam: small grit at urethral opening. Urinalysis: pH 8.0, struvite crystals heavy, +3 blood, no growth on rapid culture. " +
      "Plan: hospitalise overnight.\n\n" +
      "Prescription:\n" +
      "- Hartmann's solution IV 2.5 mL/kg/hr x 12 hours (in-clinic, dispense 0)\n" +
      "- Buprenorphine 0.02 mg/kg IV q6h x 24 hours, dispense 1.5 mL of 0.3 mg/mL injectable\n" +
      "- Meloxicam 0.1 mg/kg PO SID x 5 days, dispense 5 mL of 1.5 mg/mL oral suspension\n" +
      "- Royal Canin Urinary SO 4 kg, dispense 1 bag\n\n" +
      "Urethral cath if obstruction worsens. X-ray + ultrasound tomorrow morning. Discussed cystotomy possibility with owner. Recheck 48h post-op or sooner if straining recurs.",
  },
  {
    id: "cysto",
    label: "Cystoliths pre-op (Milo)",
    blurb: "Bladder stones, surgery tomorrow · X-ray + bloods today",
    text:
      "Milo, 8yo MN Mini Schnauzer, 9.8kg. 2-week history of haematuria + straining. " +
      "Owner went to external clinic 1 week ago — prescribed amox-clav 250mg BID x7d + Royal Canin Urinary SO. " +
      "No improvement. QAR. T 38.7, HR 110, RR 28. Mild caudal abdominal discomfort. " +
      "Abdominal X-ray: 2 large cystoliths nearly filling bladder, multiple smaller uroliths scattered along urethra. " +
      "Plan: pre-op bloods + urine C/S today, NPO from 22:00, cystotomy 02 Dec 09:00. " +
      "Submit stones for analysis post-op. Continue Urinary SO pending result.",
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
      {rx.length === 0 && (
        <div
          style={{
            padding: "16px 0 4px",
            fontSize: 13,
            color: C.muted,
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          No medications prescribed for this visit.
        </div>
      )}
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
// Medication schedule
// ─────────────────────────────────────────────────────────────────────
type MedFrequency =
  | "once_daily"
  | "twice_daily"
  | "every_x_hours"
  | "weekly"
  | "custom";

type MedSchedulePayload = {
  pet_id: string;
  owner_id: string;
  frequency: MedFrequency;
  interval_hours?: number;
  days_of_week?: number[];
  times: string[];
  start_date: string;
  end_date: string;
  meal_relation: "before_meal" | "after_meal" | "none";
  notes: string;
};

const MED_PRESETS: {
  id: "once_daily" | "twice_daily" | "every_8h" | "weekly" | "custom";
  label: string;
  hint: string;
}[] = [
  { id: "once_daily",  label: "Once daily",    hint: "1× / day"   },
  { id: "twice_daily", label: "Twice daily",   hint: "2× / day"   },
  { id: "every_8h",   label: "Every 8 hours", hint: "3× / day"   },
  { id: "weekly",     label: "Once weekly",   hint: "1× / week"  },
  { id: "custom",     label: "Custom",        hint: "fully manual" },
];

const MED_DURATION_DAYS = [3, 5, 7, 14];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? C.text : C.border}`,
        background: active ? C.text : "transparent",
        color: active ? "#fff" : C.text,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 130ms ease, border-color 130ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function MedicationScheduleCard({
  patient,
  onSubmit,
}: {
  patient: Patient;
  onSubmit: (payload: MedSchedulePayload) => void;
}) {
  const [presetId, setPresetId] =
    useState<(typeof MED_PRESETS)[number]["id"]>("once_daily");
  const [startDate, setStartDate] = useState<string>(todayIso());
  const [durKind, setDurKind] = useState<"days" | "custom">("days");
  const [durDays, setDurDays] = useState<number>(7);
  const [endDate, setEndDate] = useState<string>(addDaysIso(todayIso(), 6));
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [intervalHours, setIntervalHours] = useState<number>(8);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [mealRelation, setMealRelation] =
    useState<MedSchedulePayload["meal_relation"]>("none");
  const [notes, setNotes] = useState("");

  const applyPreset = (id: (typeof MED_PRESETS)[number]["id"]) => {
    setPresetId(id);
    if (id === "once_daily")  setTimes(["08:00"]);
    if (id === "twice_daily") setTimes(["08:00", "20:00"]);
    if (id === "every_8h")  { setTimes(["00:00", "08:00", "16:00"]); setIntervalHours(8); }
    if (id === "weekly")    { setTimes(["09:00"]); if (daysOfWeek.length === 0) setDaysOfWeek([1]); }
  };

  const effectiveEnd = useMemo(() => {
    if (durKind === "custom") return endDate;
    return addDaysIso(startDate, Math.max(0, durDays - 1));
  }, [durKind, durDays, startDate, endDate]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (times.length === 0) e.push("Add at least one time slot.");
    if (times.some((t) => !/^\d{2}:\d{2}$/.test(t))) e.push("Times must be in HH:MM format.");
    if ((presetId === "every_8h" || presetId === "custom") && (intervalHours <= 0 || intervalHours > 24))
      e.push("Interval hours must be between 1 and 24.");
    if (presetId === "weekly" && daysOfWeek.length === 0) e.push("Pick at least one weekday.");
    if (!startDate) e.push("Start date required.");
    if (effectiveEnd && effectiveEnd < startDate) e.push("End date cannot be before start date.");
    if (durKind === "custom" && !endDate) e.push("Custom end date required.");
    if (new Set(times).size !== times.length) e.push("Duplicate time slots.");
    return e;
  }, [times, presetId, intervalHours, daysOfWeek, startDate, effectiveEnd, durKind, endDate]);

  const valid = errors.length === 0;
  const sortedTimes = useMemo(() => [...times].sort(), [times]);

  const previewLine = useMemo(() => {
    const list =
      sortedTimes.length === 0 ? "(no times set)" :
      sortedTimes.length === 1 ? sortedTimes[0] :
      sortedTimes.slice(0, -1).join(", ") + " and " + sortedTimes.at(-1);
    const dowText = presetId === "weekly"
      ? ` on ${[...daysOfWeek].sort().map((d) => DOW_LABELS[d]).join(", ") || "—"}`
      : "";
    const meal =
      mealRelation === "before_meal" ? " (before meal)" :
      mealRelation === "after_meal"  ? " (after meal)"  : "";
    return `Reminders will be sent at ${list}${dowText} from ${startDate || "—"} to ${effectiveEnd || "—"}${meal}.`;
  }, [sortedTimes, daysOfWeek, presetId, mealRelation, startDate, effectiveEnd]);

  const reminderCount = useMemo(() => {
    if (!startDate || !effectiveEnd || times.length === 0) return 0;
    const a = new Date(`${startDate}T00:00:00`);
    const b = new Date(`${effectiveEnd}T00:00:00`);
    if (b < a) return 0;
    const totalDays = Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
    if (presetId === "weekly") {
      let count = 0;
      for (let i = 0; i < totalDays; i++) {
        const day = new Date(a); day.setDate(a.getDate() + i);
        if (daysOfWeek.includes(day.getDay())) count += times.length;
      }
      return count;
    }
    return totalDays * times.length;
  }, [startDate, effectiveEnd, times, presetId, daysOfWeek]);

  const updateTime = (i: number, v: string) =>
    setTimes((p) => p.map((t, idx) => (idx === i ? v : t)));
  const removeTime = (i: number) =>
    setTimes((p) => p.filter((_, idx) => idx !== i));
  const addTime    = () => setTimes((p) => [...p, "12:00"]);
  const toggleDow  = (d: number) =>
    setDaysOfWeek((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);

  const handleSubmit = () => {
    if (!valid) return;
    const payload: MedSchedulePayload = {
      pet_id:   patient.id,
      owner_id: patient.owner,
      frequency: presetId === "every_8h" ? "every_x_hours" : (presetId as MedFrequency),
      ...(presetId === "every_8h" || presetId === "custom" ? { interval_hours: intervalHours } : {}),
      ...(presetId === "weekly"   || presetId === "custom" ? { days_of_week: [...daysOfWeek].sort() } : {}),
      times: sortedTimes,
      start_date:    startDate,
      end_date:      effectiveEnd,
      meal_relation: mealRelation,
      notes:         notes.trim(),
    };
    onSubmit(payload);
  };

  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
    textTransform: "uppercase", color: C.hint, marginBottom: 8,
  };

  const inp: React.CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "8px 10px", background: C.card, color: C.text,
    fontFamily: "inherit", fontSize: 13, outline: "none",
  };

  return (
    <OutputCardShell
      title="Medication schedule"
      meta={reminderCount > 0 ? `${reminderCount} reminder${reminderCount === 1 ? "" : "s"}` : "Not scheduled"}
      footer={
        <>
          <div style={{ flex: 1, fontSize: 11.5, color: C.muted }}>
            {valid ? "Ready to schedule." : `${errors.length} issue${errors.length === 1 ? "" : "s"} to resolve`}
          </div>
          <Button variant="ghost" size="sm" icon={Icon.check(13)} onClick={handleSubmit} disabled={!valid}>
            Save schedule
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 20 }}>

        {/* A — Quick preset */}
        <div>
          <div style={lbl}>Quick preset</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MED_PRESETS.map((p) => (
              <ChipBtn key={p.id} active={presetId === p.id} onClick={() => applyPreset(p.id)}>
                {p.label}
                <span style={{ marginLeft: 6, fontSize: 10.5, opacity: 0.65, fontWeight: 500 }}>
                  {p.hint}
                </span>
              </ChipBtn>
            ))}
          </div>
        </div>

        {/* B — Configuration */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Left: start + duration */}
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={lbl}>Start date</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ ...inp, width: "100%" }}
              />
            </div>
            <div>
              <div style={lbl}>Duration</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {MED_DURATION_DAYS.map((d) => (
                  <ChipBtn
                    key={d}
                    active={durKind === "days" && durDays === d}
                    onClick={() => { setDurKind("days"); setDurDays(d); }}
                  >
                    {d} days
                  </ChipBtn>
                ))}
                <ChipBtn active={durKind === "custom"} onClick={() => setDurKind("custom")}>
                  Custom
                </ChipBtn>
              </div>
              {durKind === "custom" && (
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ ...inp, width: "100%" }}
                />
              )}
            </div>
          </div>

          {/* Right: times + frequency extras */}
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={{ ...lbl, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Times</span>
                <button
                  type="button"
                  onClick={addTime}
                  style={{
                    background: "transparent", border: "none",
                    color: C.text, fontSize: 11, fontWeight: 700,
                    letterSpacing: 1.1, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  + Add time
                </button>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {times.length === 0 && (
                  <div style={{ fontSize: 12.5, color: C.muted }}>No times added yet.</div>
                )}
                {times.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => updateTime(i, e.target.value)}
                      style={{ ...inp, fontFamily: FONT_MONO }}
                    />
                    <button
                      type="button"
                      onClick={() => removeTime(i)}
                      style={{
                        background: "transparent", border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: "6px 10px",
                        fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {(presetId === "every_8h" || presetId === "custom") && (
              <div>
                <div style={lbl}>Every X hours</div>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(Number(e.target.value) || 0)}
                  style={{ ...inp, width: 110 }}
                />
              </div>
            )}

            {(presetId === "weekly" || presetId === "custom") && (
              <div>
                <div style={lbl}>Weekdays</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {DOW_LABELS.map((label, idx) => (
                    <ChipBtn key={label} active={daysOfWeek.includes(idx)} onClick={() => toggleDow(idx)}>
                      {label}
                    </ChipBtn>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Meal relation */}
        <div>
          <div style={lbl}>Meal relation</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([ { id: "before_meal", label: "Before meal" }, { id: "after_meal", label: "After meal" }, { id: "none", label: "No preference" } ] as const).map((m) => (
              <ChipBtn key={m.id} active={mealRelation === m.id} onClick={() => setMealRelation(m.id)}>
                {m.label}
              </ChipBtn>
            ))}
          </div>
        </div>

        {/* Notes — left column */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={lbl}>Notes (not used for automation)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Give with small treat to ease swallowing."
              style={{ ...inp, width: "100%", resize: "vertical", minHeight: 64, fontFamily: "inherit" }}
            />
            <div style={{ fontSize: 11, color: C.hint, marginTop: 5 }}>Owner: {patient.owner}</div>
          </div>
        </div>

        {/* C — Live preview */}
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 14 }}>
          <div style={lbl}>Live preview</div>
          <div
            style={{
              fontSize: 13.5, color: C.text, lineHeight: 1.55,
              padding: "12px 14px", background: C.bgAlt,
              border: `1px solid ${C.borderSoft}`, borderRadius: 8,
            }}
          >
            {previewLine}
          </div>
        </div>

        {/* D — Validation errors */}
        {errors.length > 0 && (
          <div
            style={{
              borderRadius: 8, border: `1px solid ${C.amberBorder}`,
              padding: "10px 12px", fontSize: 12.5, color: C.amber,
              display: "grid", gap: 4,
            }}
          >
            {errors.map((e, i) => <div key={i}>· {e}</div>)}
          </div>
        )}

      </div>
    </OutputCardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
/**
 * Off-critical-path evidence check card. Auto-fires after the main
 * pipeline completes and the orchestrator output (`output`) is
 * available. Shows a "checking" spinner, then resolves to:
 *   - clear: green ✓ summary, optionally with citations
 *   - warning: amber ⚠ banner with the cited concern
 *   - unknown: muted "no recent literature found" line
 *
 * Cached repeats hit Supabase in ~50ms; first-of-its-kind queries
 * take 8-15s. Either way the doctor's main output is already on
 * screen so they're never blocked.
 */
function EvidenceCheckCard({
  patient,
  output,
}: {
  patient: Patient;
  output: ConsultOutput;
}) {
  type State =
    | { kind: "checking" }
    | {
        kind: "done";
        status: "clear" | "warning" | "unknown";
        summary: string;
        citations: { title: string; url: string }[];
        cached: boolean;
        latencyMs: number;
      }
    | { kind: "error"; message: string };
  const [state, setState] = useState<State>({ kind: "checking" });

  // Re-check whenever the output's prescription set changes — e.g. a
  // regenerate produces a different drug list. Cached responses make
  // re-runs near-instant on the same drug+species combo.
  const drugKey = output.prescription.map((p) => p.drug).join("|");
  useEffect(() => {
    let cancelled = false;
    setState({ kind: "checking" });
    const drugs = output.prescription.map((p) => p.drug).filter(Boolean);
    const diagnosis = output.soap.A?.split(/\.\s/)[0] ?? "";
    api
      .evidenceCheck({
        patientName: patient.name,
        patientSpecies: patient.species,
        diagnosis,
        drugs,
      })
      .then((r) => {
        if (cancelled) return;
        setState({
          kind: "done",
          status: r.status,
          summary: r.summary,
          citations: r.citations,
          cached: !!r.cached,
          latencyMs: r.latencyMs,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "check failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id, patient.name, patient.species, output.soap.A, drugKey]);

  const palette =
    state.kind === "done" && state.status === "warning"
      ? { bg: C.amberLight, border: C.amberBorder, label: C.amber, dot: C.amber }
      : state.kind === "done" && state.status === "clear"
        ? { bg: C.greenLight, border: C.greenBorder, label: C.greenDark, dot: C.green }
        : { bg: C.bgAlt, border: C.borderSoft, label: C.muted, dot: C.muted };

  return (
    <div
      style={{
        marginTop: 14,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        animation: "fadeUp 320ms ease both",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 18,
          lineHeight: 1.2,
          marginTop: 1,
        }}
      >
        {state.kind === "checking"
          ? "🔍"
          : state.kind === "error"
            ? "⚠️"
            : state.status === "warning"
              ? "⚠️"
              : state.status === "clear"
                ? "✓"
                : "ℹ️"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: palette.label,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Evidence check
          {state.kind === "checking" && (
            <span
              style={{
                fontSize: 10.5,
                color: C.hint,
                fontWeight: 500,
                letterSpacing: 0,
                textTransform: "none",
              }}
            >
              · cross-referencing 2024–2025 literature…
            </span>
          )}
          {state.kind === "done" && (
            <span
              style={{
                fontSize: 10.5,
                color: C.hint,
                fontWeight: 500,
                letterSpacing: 0,
                textTransform: "none",
                fontFamily: FONT_MONO,
              }}
            >
              · {state.cached ? "cached" : `${(state.latencyMs / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.text,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {state.kind === "checking"
            ? "Querying Tavily for recent recalls and new contraindications…"
            : state.kind === "error"
              ? `Check unavailable: ${state.message}`
              : state.summary}
        </div>
        {state.kind === "done" && state.citations.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 11,
            }}
          >
            {state.citations.slice(0, 3).map((c, i) => (
              <a
                key={`${c.url}-${i}`}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: palette.label,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  maxWidth: 320,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={c.title}
              >
                {c.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldHeader({
  label,
  hint,
  count,
}: {
  label: string;
  hint: string;
  count: number;
}) {
  return (
    <div
      style={{
        padding: "10px 22px 8px",
        background: C.bgAlt,
        borderTop: `1px solid ${C.borderSoft}`,
        display: "flex",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11.5, color: C.hint }}>· {hint}</div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: C.hint, fontFamily: FONT_MONO }}>
        {count} chars
      </div>
    </div>
  );
}

function TelegramLinkRow({ patient }: { patient: Patient }) {
  const { flashToast, refresh } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(patient.ownerTelegram ?? "");
  const [saving, setSaving] = useState(false);
  const linked = !!patient.ownerTelegram;

  // When the underlying patient changes (e.g. dashboard refresh), reset
  // the local draft so the field reflects the new server-side value.
  useEffect(() => {
    setDraft(patient.ownerTelegram ?? "");
    setEditing(false);
  }, [patient.id, patient.ownerTelegram]);

  async function save() {
    const trimmed = draft.trim();
    setSaving(true);
    try {
      await api.setPatientTelegram(patient.id, trimmed || null);
      flashToast(
        trimmed
          ? `Telegram linked · ${patient.name}`
          : `Telegram unlinked · ${patient.name}`,
      );
      setEditing(false);
      void refresh();
    } catch (err) {
      flashToast(
        err instanceof Error ? err.message : "Failed to update Telegram link",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        borderTop: `1px solid ${C.border}`,
        padding: "10px 20px",
        background: linked ? "#FFFFFF" : C.bgAlt,
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
          color: linked ? C.brand : C.hint,
        }}
      >
        Owner Telegram
      </span>
      <span style={{ color: C.border }}>·</span>
      {editing ? (
        <>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            autoFocus
            placeholder="123456789 or @username"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              padding: "4px 10px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              outline: "none",
              minWidth: 220,
              background: "#fff",
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            style={saving ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(patient.ownerTelegram ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              color: linked ? C.text : C.hint,
              fontWeight: 500,
            }}
          >
            {linked ? patient.ownerTelegram : "Not linked yet"}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background: "transparent",
              border: "none",
              color: C.brand,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {linked ? "Edit" : "Link Telegram"}
          </button>
        </>
      )}
    </div>
  );
}

function ConsultContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pid = params.get("pid");
  const { flashToast, patients } = useStore();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  // `patient` is resolved further below via fetch-on-demand to handle
  // the realtime-arrival race; the old `patients.find(...) || patients[0]`
  // line was a duplicate from a merge that silently fell back to the
  // wrong patient. Don't reintroduce it.
  const [switchOpen, setSwitchOpen] = useState(false);
  const switchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const switchMenuRef = useRef<HTMLDivElement | null>(null);
  const [switchAnchor, setSwitchAnchor] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!switchOpen) return;
    const updateAnchor = () => {
      const el = switchTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSwitchAnchor({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };
    updateAnchor();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (switchTriggerRef.current?.contains(t)) return;
      if (switchMenuRef.current?.contains(t)) return;
      setSwitchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSwitchOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [switchOpen]);

  // Fetch-on-demand for patients arriving from a Realtime push: when the
  // doctor clicks "Open consult" on a new-patient banner, the local
  // `patients` array hasn't yet been refreshed by the async Realtime
  // callback. Falling back to patients[0] silently loaded the wrong
  // patient; instead, fetch the single patient by id while we wait.
  const localPatient = pid
    ? patients.find((p) => p.id === pid)
    : patients[0];
  const [fetchedPatient, setFetchedPatient] = useState<Patient | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "not-found">(
    "idle",
  );

  useEffect(() => {
    if (!pid) {
      setFetchedPatient(null);
      setFetchState("idle");
      return;
    }
    if (patients.find((p) => p.id === pid)) {
      setFetchedPatient(null);
      setFetchState("idle");
      return;
    }
    if (fetchedPatient?.id === pid) return;
    let cancelled = false;
    setFetchState("loading");
    setFetchedPatient(null);
    api
      .getPatient(pid)
      .then((res) => {
        if (cancelled) return;
        setFetchedPatient(res.patient);
        setFetchState("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedPatient(null);
        setFetchState("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [pid, patients, fetchedPatient?.id]);

  const patient = localPatient ?? fetchedPatient;

  // Two separate inputs that flow into the same orchestrator call:
  //   - `conversation` is the auto-transcribed back-and-forth between vet
  //     and owner during the visit. Mic recordings append here.
  //   - `notes` is the doctor's structured clinical shorthand (SOAP-style
  //     observations, plan). Typed only.
  // Merged into one block in `combinedNotes` before sending to /api/consult.
  const [conversation, setConversation] = useState("");
  const [notes, setNotes] = useState("");
  const combinedNotes = [
    conversation.trim() &&
      `Conversation transcript:\n${conversation.trim()}`,
    notes.trim() && `Doctor's notes:\n${notes.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
  // Multi-agent stream replaces the legacy single-call /api/consult flow.
  // The pipeline visualization (ArchitectureDiagram / Timeline / TavilyFeed)
  // is opt-in via showPipeline — default off so routine consults stay calm,
  // doctors who want transparency can toggle it on per session.
  const stream = useCaptureStream();
  const [showPipeline, setShowPipeline] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const mediaStream = useRef<MediaStream | null>(null);

  // Image attachments — vet uploads of wound, lab, X-ray photos. Uploaded
  // to consult-photos bucket on submit; URLs flow into api.consult.
  type Attachment = { file: File; previewUrl: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  // chatId resolution chain — priority: patient.ownerTelegram (DB) >
  // localStorage > NEXT_PUBLIC_DEV_TELEGRAM_CHAT_ID > "". Re-resolves
  // whenever the patient changes (e.g. switching patients in the
  // dashboard) so the SendPanel always shows the right value.
  const [telegramChatId, setTelegramChatId] = useState("");
  useEffect(() => {
    const fromPatient = patient?.ownerTelegram?.trim() ?? "";
    const fromStorage =
      typeof window !== "undefined"
        ? window.localStorage.getItem("consilium.telegramChatId") ?? ""
        : "";
    const fromEnv = process.env.NEXT_PUBLIC_DEV_TELEGRAM_CHAT_ID ?? "";
    setTelegramChatId(fromPatient || fromStorage || fromEnv);
  }, [patient?.id, patient?.ownerTelegram]);
  // Persist the chat ID to localStorage whenever the doctor edits it,
  // so the next consult on this browser auto-fills.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!telegramChatId.trim()) return;
    try {
      window.localStorage.setItem(
        "consilium.telegramChatId",
        telegramChatId.trim(),
      );
    } catch {
      // Quota / private mode — non-fatal
    }
  }, [telegramChatId]);
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Derive the existing UI shape from the orchestrator's summary so the
  // SOAP / Rx / billing / todo cards below render unchanged. The new
  // pipeline produces `summary.doctorSummary.soap`, `summary.prescription`,
  // `summary.billing`, `summary.todos` — the existing card components only
  // ever wanted these four fields.
  const output: ConsultOutput | null = useMemo(() => {
    if (!stream.result) return null;
    return {
      soap: stream.result.summary.doctorSummary.soap,
      prescription: stream.result.summary.prescription,
      billing: stream.result.summary.billing,
      todos: stream.result.summary.todos,
    };
  }, [stream.result]);
  const generating = stream.running;
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
    if (!combinedNotes || !patient) return;
    try {
      // Upload any attached photos first; URLs flow into the multi-agent
      // text-agent (which validates them against the SSRF allowlist).
      let imageUrls: string[] | undefined;
      if (attachments.length > 0) {
        setUploading(true);
        try {
          const { uploads } = await api.uploadPhotos(
            attachments.map((a) => a.file),
            "consult-photos",
          );
          imageUrls = uploads
            .map((u) => u.url)
            .filter((u): u is string => Boolean(u));
          if (imageUrls && imageUrls.length > 0) {
            flashToast(`Uploaded ${imageUrls.length} photo${imageUrls.length === 1 ? "" : "s"}`);
          }
        } finally {
          setUploading(false);
        }
      }

      // Drive the SSE stream and use the terminal result returned by
      // start() — reading stream.result here is unsafe (closure-captured
      // pre-reset value). The hook also writes the same result to state
      // for reactive rendering.
      // Send the doctor's typed shorthand as `notes` (what the
      // text/billing/prescription agents read) and the Deepgram
      // transcript as `transcript` (what the voice agent reads). Bundling
      // them broke the voice agent (it saw "no transcript provided")
      // and confused the prescription agent.
      const terminal = await stream.start({
        patientId: patient.id,
        notes: notes.trim() || conversation.trim(),
        transcript: conversation.trim() || undefined,
        imageUrls,
      });
      if (terminal) {
        const billing = terminal.summary.billing ?? [];
        const prescription = terminal.summary.prescription ?? [];
        const todos = terminal.summary.todos ?? [];
        const flagged = billing
          .filter((b) => b.flagged)
          .reduce((a, b) => a + b.price, 0);
        flashToast(
          flagged > 0
            ? `Extracted · ${billing.length} billing items · RM ${flagged} recoverable`
            : `Extracted · SOAP + ${prescription.length} rx + ${todos.length} todos`,
        );
      }
    } catch (err) {
      flashToast(err instanceof Error ? err.message : "Generation failed");
    }
  };

  // Surface stream-channel errors (mid-stream Tavily/orchestrator failure,
  // network drop) to the toast even when the pipeline panel is hidden.
  // Without this, a hidden-panel doctor sees nothing — generating just
  // stops. The catch block in generate() only fires for thrown rejections;
  // SSE error events arrive asynchronously and only set stream.error.
  useEffect(() => {
    if (stream.error) flashToast(`Pipeline error: ${stream.error}`);
  }, [stream.error, flashToast]);

  const stopMicTracks = () => {
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((t) => t.stop());
      mediaStream.current = null;
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      // Stop — onstop will fire transcription.
      mediaRecorder.current?.stop();
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = null;
      setRecording(false);
      setRecordSec(0);
      return;
    }

    // Start
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      flashToast("Mic not supported in this browser");
      return;
    }
    // Probe MediaRecorder for a MIME the browser will actually honor.
    // Hardcoding "audio/webm" silently produced corrupt streams in some
    // builds (browser fell back to a different codec but the Blob kept
    // the webm label, Deepgram then rejected with "corrupt or unsupported
    // data"). Pick the first supported in priority order — Deepgram
    // accepts webm/opus, ogg/opus, and mp4 directly.
    const candidateMimes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    const supportedMime =
      typeof MediaRecorder !== "undefined"
        ? candidateMimes.find((m) => MediaRecorder.isTypeSupported(m))
        : undefined;
    if (!supportedMime) {
      flashToast("Browser cannot record any Deepgram-compatible audio format");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.current = stream;
      audioChunks.current = [];
      const mr = new MediaRecorder(stream, { mimeType: supportedMime });
      mediaRecorder.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.current.push(e.data);
      };
      mr.onstop = async () => {
        stopMicTracks();
        // Use the recorder's actual MIME (mr.mimeType) — browsers may
        // append the negotiated codec, and we want the Blob's type to
        // match the bytes exactly so the transcribe route forwards the
        // right Content-Type to Deepgram.
        const recordedMime = mr.mimeType || supportedMime;
        const blob = new Blob(audioChunks.current, { type: recordedMime });
        audioChunks.current = [];
        if (blob.size === 0) return;
        // Anything under ~1KB is almost certainly the EBML header alone
        // (no audio frames) — happens when the user stops within a few
        // hundred ms of starting. Deepgram rejects header-only payloads
        // with "corrupt or unsupported data". Surface a clearer error.
        if (blob.size < 1024) {
          flashToast("Recording too short — hold the mic for at least 1 second");
          return;
        }
        setTranscribing(true);
        try {
          const { transcript } = await api.transcribe(blob);
          if (transcript) {
            setConversation((prev) =>
              prev ? `${prev.trim()} ${transcript}` : transcript,
            );
            flashToast("Transcribed · Deepgram nova-3");
          } else {
            flashToast("No speech detected");
          }
        } catch (err) {
          flashToast(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      // 250ms timeslice — without this, MediaRecorder only emits
      // ondataavailable on stop. If the user stops quickly, the encoder
      // hasn't flushed any audio frames yet and we get a header-only
      // blob that Deepgram rejects. With timeslice, frames accumulate
      // every 250ms so even a fast stop produces decodable audio.
      mr.start(250);
      setRecording(true);
      setRecordSec(0);
      recordTimer.current = setInterval(() => {
        setRecordSec((s) => s + 1);
      }, 1000);
    } catch (err) {
      flashToast(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Mic permission denied"
          : "Could not access mic",
      );
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    const next: Attachment[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setAttachments((prev) => [...prev, ...next].slice(0, 6));
    e.target.value = ""; // allow re-picking the same file
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const dropped = prev[idx];
      if (dropped) URL.revokeObjectURL(dropped.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
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

  if (fetchState === "not-found") {
    return (
      <div style={{ padding: "0 32px 120px", maxWidth: 1480, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Consultation"
          title="Patient not found."
          sub="The patient id in the URL does not match any record in this clinic."
          right={
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" icon={Icon.back(14)}>
                Dashboard
              </Button>
            </Link>
          }
        />
        <Card
          style={{
            padding: "44px 28px",
            textAlign: "center",
            boxShadow: SHADOW_CARD,
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
            We could not load this patient
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.muted,
              maxWidth: 420,
              margin: "0 auto 16px",
              lineHeight: 1.55,
            }}
          >
            The patient id <code style={{ fontFamily: FONT_MONO }}>{pid}</code>{" "}
            does not exist or was removed. Head back to the dashboard to pick a
            patient from the schedule.
          </div>
          <Link href="/dashboard">
            <Button size="md" icon={Icon.back(14)}>
              Back to dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ padding: "0 32px 120px", maxWidth: 1480, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Consultation"
          title="Loading patient…"
          sub="Fetching record from the clinic database."
          right={
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" icon={Icon.back(14)}>
                Dashboard
              </Button>
            </Link>
          }
        />
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
            }}
          >
            <Skeleton height={44} width={44} radius="50%" />
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <Skeleton height={20} width="32%" />
              <Skeleton height={12} width="48%" />
            </div>
            <Skeleton height={22} width={70} radius={999} />
          </div>
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              padding: "10px 20px",
              background: C.bgAlt,
            }}
          >
            <Skeleton height={12} width="55%" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 32px 120px", maxWidth: 1480, margin: "0 auto" }}>
      {/* Patient context bar */}
      <PageHeader
        eyebrow="Consultation"
        title="Capture today's visit."
        sub={`${CLINIC.doctor} · ${CLINIC.name} · ${new Date().toLocaleDateString("en-GB", {
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
          <button
            ref={switchTriggerRef}
            type="button"
            onClick={() => setSwitchOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={switchOpen}
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
          {switchOpen && switchAnchor && typeof document !== "undefined" &&
            createPortal(
              <div
                ref={switchMenuRef}
                role="listbox"
                style={{
                  position: "fixed",
                  top: switchAnchor.top,
                  right: switchAnchor.right,
                  minWidth: 280,
                  maxHeight: 360,
                  overflowY: "auto",
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  boxShadow: SHADOW_CARD,
                  zIndex: 1000,
                  padding: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.3,
                    textTransform: "uppercase",
                    color: C.hint,
                    padding: "6px 10px 8px",
                  }}
                >
                  Select patient
                </div>
                {patients.map((op) => {
                  const active = op.id === patient.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setSwitchOpen(false);
                        if (!active) {
                          router.push(`/consult?pid=${encodeURIComponent(op.id)}`);
                        }
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: active ? C.bgAlt : "transparent",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 10px",
                        cursor: active ? "default" : "pointer",
                        fontFamily: "inherit",
                        color: C.text,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = C.bgAlt;
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: C.text,
                            letterSpacing: -0.1,
                          }}
                        >
                          {op.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                          {op.species} · {op.breed} · Owner {op.owner}
                        </div>
                      </div>
                      {active && (
                        <span style={{ fontSize: 11, color: C.hint }}>current</span>
                      )}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
        </div>
        {/* Chief complaint — what the receptionist typed in today.
            Only shown when patient.reason is populated (receptionist flow). */}
        {patient.reason && (
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              padding: "12px 20px",
              background: "#fff",
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: C.amber,
                flexShrink: 0,
              }}
            >
              Chief complaint
            </span>
            <span style={{ color: C.border }}>·</span>
            <span
              style={{
                fontSize: 14,
                color: C.text,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {patient.reason}
            </span>
          </div>
        )}
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
        <TelegramLinkRow patient={patient} />
      </Card>

      {/* Pipeline visibility toggle + (when on) live agent execution view.
          Off by default — routine consults stay calm. On for transparency:
          doctor sees the parallel fan-out, Tavily searches, orchestrator
          step animate as the consult is processed. */}
      <PipelineToggleBar
        showPipeline={showPipeline}
        onToggle={() => setShowPipeline((v) => !v)}
        running={generating}
        result={stream.result}
      />
      {showPipeline && (
        <PipelinePanel
          lanes={stream.lanes}
          orchestratorRange={stream.orchestratorRange}
          tavilyEvents={stream.tavilyEvents}
          t0={stream.t0}
          tEnd={stream.tEnd}
          error={stream.error}
        />
      )}

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
                {recording
                  ? `Recording ${fmtTime(recordSec)}`
                  : transcribing
                  ? "Transcribing…"
                  : "Record voice"}
              </button>

              {/* Photo attach */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPickFiles}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= 6}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 8,
                  background: "#fff",
                  border: `1px solid ${C.border}`,
                  color: attachments.length >= 6 ? C.hint : C.text,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: attachments.length >= 6 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
                title="Attach photos (wound, lab, X-ray) — max 6"
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>📎</span>
                {attachments.length > 0
                  ? `${attachments.length} photo${attachments.length === 1 ? "" : "s"}`
                  : "Attach photo"}
              </button>

              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontSize: 11,
                  color: C.hint,
                  letterSpacing: 0.3,
                }}
              >
                {conversation.length + notes.length} chars
              </div>
            </div>

            {/* Attachment thumbnail strip */}
            {attachments.length > 0 && (
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  background: C.bgAlt,
                }}
              >
                {attachments.map((a, i) => (
                  <div
                    key={`${a.file.name}-${i}`}
                    style={{
                      position: "relative",
                      width: 56,
                      height: 56,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: `1px solid ${C.border}`,
                      background: "#fff",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.previewUrl}
                      alt={a.file.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      aria-label="Remove"
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        border: "none",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        fontSize: 12,
                        lineHeight: "16px",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Two stacked fields: live conversation transcript on top
                (mic feeds here), structured doctor notes below. Both flow
                into the orchestrator as a merged block (combinedNotes). */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: "auto auto",
              }}
            >
              <FieldHeader
                label="Conversation transcript"
                hint={
                  recording
                    ? `Listening · ${fmtTime(recordSec)}`
                    : transcribing
                    ? "Transcribing…"
                    : "Tap mic above to record vet/owner conversation"
                }
                count={conversation.length}
              />
              <textarea
                value={conversation}
                onChange={(e) => setConversation(e.target.value)}
                placeholder="Voice recording transcribes here automatically. You can also type or paste."
                style={{
                  width: "100%",
                  minHeight: 160,
                  resize: "vertical",
                  padding: "16px 22px",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: C.text,
                  fontFamily: "inherit",
                  background: "#fff",
                  display: "block",
                  boxSizing: "border-box",
                  fontStyle: conversation ? "normal" : "italic",
                  borderBottom: `1px solid ${C.borderSoft}`,
                }}
              />
              <FieldHeader
                label="Doctor's notes"
                hint="SOAP-style observations, exam findings, plan"
                count={notes.length}
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type your clinical findings — exam, vitals, assessment, plan…"
                style={{
                  width: "100%",
                  minHeight: 200,
                  resize: "vertical",
                  padding: "16px 22px",
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
            </div>
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
            {(conversation || notes) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConversation("");
                  setNotes("");
                }}
              >
                Clear
              </Button>
            )}
            <Button
              size="md"
              onClick={generate}
              icon={Icon.spark(14)}
              style={
                !combinedNotes || generating || uploading
                   ? { opacity: 0.45, pointerEvents: "none" }
                  : undefined
              }
            >
              {uploading
                ? "Uploading photos…"
                : generating
                ? "Generating…"
                : output
                ? "Regenerate structured output"
                : "Generate structured output"}
            </Button>
            {output && (
              <Button
                variant="primary"
                size="md"
                style={{
                  background:
                    saveState === "saved" ? "#10b981" : "#10b93aff",
                  borderColor: "#10b981",
                  opacity: saveState === "saving" ? 0.6 : 1,
                  pointerEvents: saveState === "idle" ? "auto" : "none",
                }}
                icon={Icon.check(14)}
                onClick={async () => {
                  setSaveState("saving");
                  if (!patient || !output) return;
                  try {
                    await api.createVisit({
                      patientId: patient.id,
                      patientName: patient.name,
                      rawNotes: combinedNotes,
                      soap: output.soap,
                      prescription: output.prescription,
                      billing: output.billing,
                      todos: output.todos,
                      // Pass owner_telegram so the bot can correlate
                      // future owner messages back to this visit.
                      telegramChatId: patient.ownerTelegram ?? undefined,
                    });
                    setSaveState("saved");
                    flashToast(
                      `Consultation done · ${patient.name} saved · returning to dashboard`,
                    );
                    setTimeout(() => router.push("/dashboard"), 1400);
                  } catch (err) {
                    setSaveState("idle");
                    flashToast("Failed to save visit");
                  }
                }}
              >
                {saveState === "saved"
                  ? "Done · redirecting…"
                  : saveState === "saving"
                    ? "Saving…"
                    : "Finish & Save Visit"}
              </Button>
            )}
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

          {status === "generating" && !showPipeline && (
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
          {status === "generating" && showPipeline && (
            // Pipeline panel above is already showing live agent state —
            // a quiet placeholder here keeps the right column from
            // looking empty without duplicating "we're working" copy.
            <div
              style={{
                padding: "20px 24px",
                fontSize: 12.5,
                color: C.muted,
                textAlign: "center",
              }}
            >
              Synthesizing summary — see the pipeline above for live progress.
            </div>
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
              <EvidenceCheckCard
                patient={patient}
                output={output}
              />
            </div>
          )}
        </div>
      </div>

      {/* Medication schedule — always visible; vet builds the reminder
          schedule here after reviewing the prescription. */}
      <div style={{ marginTop: 36 }}>
        <h3
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: -0.3,
            margin: "0 0 4px",
            color: C.text,
          }}
        >
          Medication schedule
        </h3>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
          Build a reminder schedule for the owner.
        </div>
        <MedicationScheduleCard
          patient={patient}
          onSubmit={(payload) => {
            console.log("[medication-schedule] payload", payload);
            flashToast(
              `Schedule saved · ${payload.times.length} time${payload.times.length === 1 ? "" : "s"} · ${payload.start_date} → ${payload.end_date}`,
            );
          }}
        />
      </div>

      {/* Owner Telegram delivery — appears after the orchestrator emits
          the draft. Doctor reviews, edits if needed, enters or confirms
          the chat ID, sends. /api/consult/telegram-send handles the
          actual delivery and (option A) saves the chat ID to the
          patient record on first successful send. */}
      {stream.result && (
        <div style={{ marginTop: 36 }}>
          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: -0.3,
              margin: "0 0 4px",
              color: C.text,
            }}
          >
            Send to owner
          </h3>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            Review the draft, confirm the chat ID, deliver via Telegram. Saves the chat ID to the patient record on success.
          </div>
          <SendPanel
            result={stream.result}
            patientId={patient.id}
            patientName={patient.name}
            chatId={telegramChatId}
            onChatIdChange={setTelegramChatId}
            visitIdOverride={savedVisitId}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pipeline visibility — toggle bar + live execution panel
// ─────────────────────────────────────────────────────────────────────

function PipelineToggleBar({
  showPipeline,
  onToggle,
  running,
  result,
}: {
  showPipeline: boolean;
  onToggle: () => void;
  running: boolean;
  result: ReturnType<typeof useCaptureStream>["result"];
}) {
  const status = running
    ? "Running…"
    : result
      ? `Done · ${(result.meta.totalLatencyMs / 1000).toFixed(2)}s`
      : "Idle";
  return (
    <div
      style={{
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 10,
        background: showPipeline ? C.brandLight : C.bgAlt,
        border: `1px solid ${showPipeline ? C.brandBorder : C.border}`,
        transition: "background 180ms ease, border-color 180ms ease",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: showPipeline ? C.brand : C.muted,
        }}
      >
        Agent pipeline
      </span>
      <span style={{ color: C.border }}>·</span>
      <span style={{ fontSize: 12.5, color: C.text, fontFamily: FONT_MONO }}>
        {status}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 999,
          padding: "5px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: C.text,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {showPipeline ? "Hide pipeline" : "Show pipeline"}
      </button>
    </div>
  );
}

function PipelinePanel({
  lanes,
  orchestratorRange,
  tavilyEvents,
  t0,
  tEnd,
  error,
}: {
  lanes: ReturnType<typeof useCaptureStream>["lanes"];
  orchestratorRange: ReturnType<typeof useCaptureStream>["orchestratorRange"];
  tavilyEvents: ReturnType<typeof useCaptureStream>["tavilyEvents"];
  t0: ReturnType<typeof useCaptureStream>["t0"];
  tEnd: ReturnType<typeof useCaptureStream>["tEnd"];
  error: ReturnType<typeof useCaptureStream>["error"];
}) {
  return (
    <div
      style={{
        marginBottom: 24,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ArchitectureDiagram
          lanes={lanes}
          orchestratorRange={orchestratorRange}
          compact
        />
        <Timeline
          lanes={lanes}
          orchestratorRange={orchestratorRange}
          t0={t0}
          tEnd={tEnd}
          compact
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          Tavily feed
        </div>
        <TavilyFeed events={tavilyEvents} compact />
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: C.redLight,
              border: `1px solid ${C.redBorder}`,
              color: C.red,
              fontSize: 12.5,
            }}
          >
            Pipeline error: {error}
          </div>
        )}
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
