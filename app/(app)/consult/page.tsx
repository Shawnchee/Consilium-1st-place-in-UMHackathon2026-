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
import { C, FONT_MONO, FONT_SERIF, SHADOW_CARD } from "@/lib/tokens";
import type {
  BillingItem,
  ConsultOutput,
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
  const router = useRouter();
  const pid = params.get("pid");
  const { flashToast, patients } = useStore();
  const patient = patients.find((p) => p.id === pid) || patients[0];
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

  const [notes, setNotes] = useState("");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Derive the existing UI shape from the orchestrator's summary so the
  // SOAP / Rx / billing / todo cards below render unchanged. The new
  // pipeline produces `summary.doctorSummary.soap`, `summary.prescription`,
  // `summary.billing`, `summary.todos` — the existing card components only
  // ever wanted these four fields.
  const output: ConsultOutput | null = stream.result
    ? {
        soap: stream.result.summary.doctorSummary.soap,
        prescription: stream.result.summary.prescription,
        billing: stream.result.summary.billing,
        todos: stream.result.summary.todos,
      }
    : null;
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
    if (!notes.trim() || !patient) return;
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
          imageUrls = uploads.map((u) => u.url).filter((u): u is string => Boolean(u));
          if (imageUrls.length > 0) {
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
      const terminal = await stream.start({
        patientId: patient.id,
        notes,
        imageUrls,
      });
      if (terminal) {
        const flagged = terminal.summary.billing
          .filter((b) => b.flagged)
          .reduce((a, b) => a + b.price, 0);
        flashToast(
          flagged > 0
            ? `Extracted · ${terminal.summary.billing.length} billing items · RM ${flagged} recoverable`
            : `Extracted · SOAP + ${terminal.summary.prescription.length} rx + ${terminal.summary.todos.length} todos`,
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.current = stream;
      audioChunks.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorder.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.current.push(e.data);
      };
      mr.onstop = async () => {
        stopMicTracks();
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        audioChunks.current = [];
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const { transcript } = await api.transcribe(blob);
          if (transcript) {
            setNotes((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
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
      mr.start();
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
                {notes.length} chars
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
                !notes.trim() || generating || uploading
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
                style={{ background: "#10b93aff", borderColor: "#10b981" }}
                icon={Icon.check(14)}
                onClick={async () => {
                  try {
                    await api.createVisit({
                      patientId: patient.id,
                      rawNotes: notes,
                      soap: output.soap,
                      prescription: output.prescription,
                      billing: output.billing,
                      todos: output.todos,
                    });
                    flashToast("Visit saved successfully!");
                  } catch (err) {
                    flashToast("Failed to save visit");
                  }
                }}
              >
                Finish & Save Visit
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
            </div>
          )}
        </div>
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
          <SendPanel result={stream.result} patientId={patient.id} />
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
