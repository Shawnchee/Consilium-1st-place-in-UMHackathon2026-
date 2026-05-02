"use client";

/**
 * Doctor review-and-send panel. Renders the orchestrator's draft
 * ownerMessage with editable body + aftercare + chat-ID input + Send
 * button. POSTs to /api/consult/telegram-send and shows status feedback.
 *
 * Resets drafts to the latest orchestrator output whenever a new
 * SessionCaptureResult arrives (keyed on visitId), preserving doctor
 * edits within the same run.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CLINIC } from "@/lib/clinic";
import { hasSupabase } from "@/lib/env";
import { BORDER_HAIRLINE, C, FONT_MONO, SHADOW_CARD } from "@/lib/tokens";
import type { SessionCaptureResult } from "@/lib/agents/sub-agents/types";
import { useStore } from "@/components/app-shell/store";

type SendStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; messageId: number; chatIdSaved: boolean }
  | { kind: "error"; message: string };

type CloseStatus =
  | { kind: "idle" }
  | { kind: "closing" }
  | { kind: "closed"; passportUrl: string; messageId: number }
  | { kind: "error"; message: string };

export function SendPanel({
  result,
  patientId,
  initialChatId = "",
  emptyHint = "Run the pipeline first — the doctor review-and-send panel appears once the orchestrator emits the draft.",
}: {
  result: SessionCaptureResult | null;
  /**
   * Real patient UUID to pass to the telegram-send route. The route
   * uses it to back-write owner_telegram on first successful send.
   */
  patientId: string;
  /** Optional prefilled chat ID — typically patient.owner_telegram. */
  initialChatId?: string;
  /** Override copy for the empty-state hint. */
  emptyHint?: string;
}) {
  const [chatId, setChatId] = useState(initialChatId);
  const [bodyDraft, setBodyDraft] = useState("");
  const [aftercareDraft, setAftercareDraft] = useState("");
  const [status, setStatus] = useState<SendStatus>({ kind: "idle" });
  const [closeStatus, setCloseStatus] = useState<CloseStatus>({ kind: "idle" });
  // Doctor has typed in the body/aftercare since the last reset. Used to
  // warn before clobbering edits when a fresh pipeline run lands.
  const [dirty, setDirty] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const lastResultId = useRef<string | null>(null);
  const { closeConsultAndGeneratePassport } = useStore();
  const passportEnabled = hasSupabase();

  // Effect-driven reset (avoids the set-state-during-render anti-pattern).
  // Fires only when result.visitId changes — preserves mid-edit work
  // within the same run, replaces drafts cleanly when a new run lands.
  useEffect(() => {
    if (!result) return;
    if (result.visitId === lastResultId.current) return;
    const wasDirty = dirty && lastResultId.current !== null;
    lastResultId.current = result.visitId;
    setBodyDraft(result.summary.ownerMessage.body.replace(/\{clinic\}/g, CLINIC.name));
    setAftercareDraft(result.summary.ownerMessage.aftercare.join("\n"));
    setStatus({ kind: "idle" });
    setCloseStatus({ kind: "idle" });
    setDirty(false);
    setResetNotice(
      wasDirty
        ? "Pipeline re-ran — draft replaced with the new orchestrator output. Your edits were discarded."
        : null,
    );
    // Auto-clear the notice after 8s so it doesn't linger.
    if (wasDirty) {
      const t = setTimeout(() => setResetNotice(null), 8000);
      return () => clearTimeout(t);
    }
  }, [result, dirty]);

  if (!result) {
    return (
      <div
        style={{
          background: C.card,
          border: BORDER_HAIRLINE,
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          color: C.muted,
          fontSize: 13,
          boxShadow: SHADOW_CARD,
        }}
      >
        {emptyHint}
      </div>
    );
  }

  const aftercareLines = aftercareDraft
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  async function send() {
    if (!chatId.trim()) {
      setStatus({ kind: "error", message: "enter a Telegram chat ID first" });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/consult/telegram-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatId: chatId.trim(),
          body: bodyDraft,
          aftercare: aftercareLines,
          patientId,
          visitId: result?.visitId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: true;
        messageId?: number;
        chatIdSaved?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok || typeof json.messageId !== "number") {
        throw new Error(json.error ?? `send failed (${res.status})`);
      }
      setStatus({
        kind: "sent",
        messageId: json.messageId,
        chatIdSaved: Boolean(json.chatIdSaved),
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function closeCase() {
    if (!result) return;
    if (!chatId.trim()) {
      setCloseStatus({ kind: "error", message: "enter a Telegram chat ID first" });
      return;
    }
    setCloseStatus({ kind: "closing" });
    try {
      const r = await closeConsultAndGeneratePassport(
        patientId,
        result,
        chatId,
        { bodyDraft, aftercare: aftercareLines },
      );
      setCloseStatus({
        kind: "closed",
        passportUrl: r.passportUrl,
        messageId: r.messageId,
      });
    } catch (err) {
      setCloseStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const sending = status.kind === "sending";
  const closing = closeStatus.kind === "closing";
  const busy = sending || closing;

  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 12,
        padding: 20,
        boxShadow: SHADOW_CARD,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 360px",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {resetNotice && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: C.amberLight,
              border: `1px solid ${C.amberBorder}`,
              color: C.amber,
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {resetNotice}
          </div>
        )}
        <div>
          <SoapLabel>Owner message</SoapLabel>
          <textarea
            value={bodyDraft}
            onChange={(e) => {
              setBodyDraft(e.target.value);
              setDirty(true);
            }}
            disabled={busy}
            rows={5}
            style={textareaStyle}
          />
          <div
            style={{
              fontSize: 11,
              color: C.hint,
              marginTop: 4,
              fontFamily: FONT_MONO,
            }}
          >
            {bodyDraft.length} / 600 chars
          </div>
        </div>
        <div>
          <SoapLabel>Aftercare bullets (one per line)</SoapLabel>
          <textarea
            value={aftercareDraft}
            onChange={(e) => {
              setAftercareDraft(e.target.value);
              setDirty(true);
            }}
            disabled={busy}
            rows={4}
            style={textareaStyle}
            placeholder="Continue medication twice daily…"
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <SoapLabel>Owner Telegram chat ID</SoapLabel>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            disabled={busy}
            placeholder="123456789 or @username"
            style={{
              ...textareaStyle,
              fontFamily: FONT_MONO,
              fontSize: 13,
              padding: "10px 12px",
            }}
          />
          <div style={{ fontSize: 11, color: C.hint, marginTop: 4 }}>
            {initialChatId
              ? "Prefilled from patient record. Edit to send to a different chat."
              : "Ask the owner once — this saves to the patient record on success."}
          </div>
        </div>
        <button
          onClick={send}
          disabled={busy || !chatId.trim()}
          style={{
            background: busy || !chatId.trim() ? C.borderSoft : C.text,
            color: busy || !chatId.trim() ? C.muted : "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy || !chatId.trim() ? "not-allowed" : "pointer",
            transition: "background 140ms ease",
          }}
        >
          {sending ? "Sending…" : "Send to Telegram"}
        </button>

        {passportEnabled ? (
          <button
            onClick={closeCase}
            disabled={busy || !chatId.trim()}
            style={{
              background: busy || !chatId.trim() ? C.borderSoft : C.brand,
              color: busy || !chatId.trim() ? C.muted : "#FFFFFF",
              border: "none",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: busy || !chatId.trim() ? "not-allowed" : "pointer",
              transition: "background 140ms ease",
            }}
          >
            {closing ? "Closing case…" : "Close case & send passport"}
          </button>
        ) : (
          <div
            style={{
              padding: "10px 12px",
              border: `1px dashed ${C.border}`,
              borderRadius: 8,
              fontSize: 11.5,
              color: C.muted,
              lineHeight: 1.45,
            }}
          >
            Passport persistence disabled — configure Supabase
            (<code style={{ fontFamily: FONT_MONO, fontSize: 10.5 }}>NEXT_PUBLIC_SUPABASE_URL</code>) to enable the
            <strong> Close case</strong> action.
          </div>
        )}

        <SendStatusBlock status={status} />
        <CloseStatusBlock status={closeStatus} />
      </div>
    </div>
  );
}

function SendStatusBlock({ status }: { status: SendStatus }) {
  if (status.kind === "idle") return null;
  if (status.kind === "sending") {
    return <div style={{ fontSize: 12.5, color: C.muted }}>Sending via grammY…</div>;
  }
  if (status.kind === "sent") {
    return (
      <div
        style={{
          padding: "10px 12px",
          background: C.greenLight,
          border: `1px solid ${C.greenBorder}`,
          borderRadius: 8,
          fontSize: 12.5,
          color: C.greenDark,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 600 }}>
          Delivered · message #{status.messageId}
        </div>
        <div style={{ color: C.muted, fontSize: 11.5 }}>
          {status.chatIdSaved
            ? "Chat ID saved to patient record."
            : "Chat ID not saved (patient may already have one on file, or no Supabase admin)."}
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "10px 12px",
        background: C.redLight,
        border: `1px solid ${C.redBorder}`,
        borderRadius: 8,
        fontSize: 12.5,
        color: C.red,
      }}
    >
      {status.message}
    </div>
  );
}

function CloseStatusBlock({ status }: { status: CloseStatus }) {
  if (status.kind === "idle") return null;
  if (status.kind === "closing") {
    return (
      <div style={{ fontSize: 12.5, color: C.muted }}>
        Generating passport + delivering on Telegram…
      </div>
    );
  }
  if (status.kind === "closed") {
    return (
      <div
        style={{
          padding: "10px 12px",
          background: C.greenLight,
          border: `1px solid ${C.greenBorder}`,
          borderRadius: 8,
          fontSize: 12.5,
          color: C.greenDark,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 600 }}>
          Case closed · passport sent · message #{status.messageId}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11.5,
            color: C.ink,
            wordBreak: "break-all",
          }}
        >
          {status.passportUrl}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={status.passportUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: C.brand,
              textDecoration: "none",
            }}
          >
            View passport ↗
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard
                  .writeText(status.passportUrl)
                  .catch(() => {});
              }
            }}
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: C.brand,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            Copy link
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "10px 12px",
        background: C.redLight,
        border: `1px solid ${C.redBorder}`,
        borderRadius: 8,
        fontSize: 12.5,
        color: C.red,
      }}
    >
      {status.message}
    </div>
  );
}

function SoapLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: C.muted,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "#FFFFFF",
  border: BORDER_HAIRLINE,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: C.text,
  lineHeight: 1.5,
  resize: "vertical" as const,
  fontFamily: "inherit",
};
