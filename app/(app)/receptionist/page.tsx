"use client";

/**
 * Reception desk — front-of-house intake page. Replaces the doctor-side
 * "Add patient" modal as the canonical place to register a new patient.
 *
 * On submit, posts to /api/patients which writes to Supabase. The
 * StoreProvider's `patients` Realtime subscription picks up the INSERT
 * and surfaces a clickable banner on the doctor's dashboard so the new
 * intake auto-populates without a refresh.
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Button, Icon } from "@/components/atoms";
import { PageHeader } from "@/components/app-shell/page-header";
import { useStore } from "@/components/app-shell/store";
import { api } from "@/lib/api";
import {
  BORDER_HAIRLINE,
  C,
  FONT_MONO,
  FONT_SERIF,
  RADIUS,
  SHADOW_CARD,
} from "@/lib/tokens";

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | {
      kind: "sent";
      patient: { id: string; name: string };
    }
  | { kind: "error"; message: string };

export default function ReceptionistPage() {
  const { refresh } = useStore();
  const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"Male" | "Female">("Male");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerTelegram, setOwnerTelegram] = useState("");
  const [reason, setReason] = useState("");

  function resetForm() {
    setName("");
    setSpecies("Dog");
    setBreed("");
    setAge("");
    setSex("Male");
    setOwnerName("");
    setOwnerPhone("");
    setOwnerTelegram("");
    setReason("");
    setStatus({ kind: "idle" });
  }

  /** One-click demo data — Leo urinary obstruction case. Auto-fills the
   *  Telegram chat ID so the bot can recognise this owner immediately
   *  after Send (skips the manual Link Telegram step on the consult). */
  function loadDemo() {
    setName("Leo");
    setSpecies("Dog");
    setBreed("Labrador Retriever");
    setAge("5");
    setSex("Male");
    setOwnerName("Lim Chee Wei");
    setOwnerPhone("+60 13 928 4717");
    setOwnerTelegram("1697604097");
    setReason(
      "Owner reports straining to urinate, blood in urine x 2 days. Lethargic since this morning.",
    );
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0) {
      setStatus({ kind: "error", message: "Please enter a valid age" });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const res = await api.createPatient({
        name,
        species,
        breed,
        age: parsedAge,
        sex,
        ownerName,
        ownerPhone,
        reasonForVisit: reason.trim() || undefined,
      });
      // If a Telegram chat ID was provided, link it immediately so the
      // bot recognises this owner the moment they message — and so the
      // consult page's chat ID input prefills without an extra step.
      if (ownerTelegram.trim()) {
        try {
          await api.setPatientTelegram(res.patient.id, ownerTelegram.trim());
        } catch (err) {
          console.warn("[receptionist] telegram link failed", err);
          // Non-fatal — the patient is already created. Doctor can link
          // manually via the consult page.
        }
      }
      // The Realtime subscription on the doctor side will pick this up
      // and flash the clickable arrival banner. We also locally refresh
      // the patient list so the receptionist sees the registered count
      // update on the next visit.
      void refresh();
      setStatus({
        kind: "sent",
        patient: { id: res.patient.id, name: res.patient.name },
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send",
      });
    }
  }

  const sending = status.kind === "sending";
  const sent = status.kind === "sent";

  return (
    <div style={{ padding: "0 32px 100px", maxWidth: 980, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Reception desk"
        title="New patient intake"
        sub="Register a new pet at the front desk. Brief auto-generates and the patient appears on Dr. Amirah's dashboard instantly."
        right={
          <Button variant="soft" size="sm" onClick={loadDemo} disabled={sending}>
            Load demo data
          </Button>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 280px",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* --------- FORM --------- */}
        <div
          style={{
            background: C.card,
            border: BORDER_HAIRLINE,
            borderRadius: RADIUS.lg,
            boxShadow: SHADOW_CARD,
            overflow: "hidden",
          }}
        >
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                style={{ padding: "44px 36px" }}
              >
                <SentState
                  patient={status.patient}
                  onAddAnother={resetForm}
                />
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ padding: "32px 36px", display: "grid", gap: 18 }}
              >
                {status.kind === "error" && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: C.redLight,
                      border: `1px solid ${C.redBorder}`,
                      borderRadius: RADIUS.md,
                      color: C.red,
                      fontSize: 13,
                    }}
                  >
                    {status.message}
                  </div>
                )}

                <Field label="Pet name">
                  <input
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={sending}
                    placeholder="e.g. Leo"
                    style={inputStyle}
                  />
                </Field>

                <Row>
                  <Field label="Species">
                    <input
                      required
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      disabled={sending}
                      placeholder="Dog"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Breed">
                    <input
                      required
                      value={breed}
                      onChange={(e) => setBreed(e.target.value)}
                      disabled={sending}
                      placeholder="Labrador Retriever"
                      style={inputStyle}
                    />
                  </Field>
                </Row>

                <Row>
                  <Field label="Age (years)">
                    <input
                      required
                      type="number"
                      min={0}
                      max={50}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      disabled={sending}
                      placeholder="5"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Sex">
                    <select
                      value={sex}
                      onChange={(e) =>
                        setSex(e.target.value as "Male" | "Female")
                      }
                      disabled={sending}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>
                </Row>

                <div
                  style={{
                    height: 1,
                    background: C.borderSoft,
                    margin: "6px 0",
                  }}
                />

                <Field label="Owner name">
                  <input
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    disabled={sending}
                    placeholder="e.g. Lim Chee Wei"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Owner phone">
                  <input
                    required
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    disabled={sending}
                    placeholder="+60 13 928 4717"
                    style={{ ...inputStyle, fontFamily: FONT_MONO }}
                  />
                </Field>

                <Field label="Owner Telegram (optional)">
                  <input
                    type="text"
                    value={ownerTelegram}
                    onChange={(e) => setOwnerTelegram(e.target.value)}
                    disabled={sending}
                    placeholder="123456789 or @username"
                    style={{ ...inputStyle, fontFamily: FONT_MONO }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: C.hint,
                      marginTop: 5,
                    }}
                  >
                    Linked immediately so the bot recognises this owner from
                    their first message.
                  </div>
                </Field>

                <Field label="What to probe today">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={sending}
                    maxLength={500}
                    rows={3}
                    placeholder="Owner reports straining to urinate, blood in urine x 2 days. No prior episodes."
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: 72,
                      fontFamily: "inherit",
                      lineHeight: 1.5,
                    }}
                  />
                </Field>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 6,
                  }}
                >
                  <Button
                    type="submit"
                    size="md"
                    disabled={sending}
                    icon={Icon.arrow(14)}
                  >
                    {sending ? "Sending…" : "Send to Dr. Amirah"}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* --------- SIDE BAR --------- */}
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <SideCard
            title="What happens next"
            body="Once you send, the patient appears on Dr. Amirah's dashboard with a real-time notification. Their pre-consult brief auto-generates from the AI within seconds."
          />
          <SideCard
            title="Tip"
            body="Ask the owner for their Telegram handle later — sending the first message saves it to the patient record automatically."
          />
        </div>
      </div>
    </div>
  );
}

function SentState({
  patient,
  onAddAnother,
}: {
  patient: { id: string; name: string };
  onAddAnother: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 18,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: C.greenLight,
          display: "grid",
          placeItems: "center",
          color: C.greenDark,
        }}
      >
        {Icon.check(26)}
      </div>
      <div>
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: -0.4,
            color: C.text,
          }}
        >
          Sent to Dr. Amirah
        </div>
        <div
          style={{
            fontSize: 14,
            color: C.muted,
            marginTop: 6,
          }}
        >
          {patient.name} is now on her dashboard.
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: C.hint,
          padding: "4px 10px",
          background: "#FFFFFF",
          border: BORDER_HAIRLINE,
          borderRadius: RADIUS.sm,
        }}
      >
        patient · {patient.id.slice(0, 8)}…
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button variant="soft" size="sm" onClick={onAddAnother}>
          Add another
        </Button>
        <Link href={`/consult?pid=${patient.id}`} style={{ textDecoration: "none" }}>
          <Button size="sm">Open consult ↗</Button>
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: C.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {children}
    </div>
  );
}

function SideCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: RADIUS.lg,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: C.muted,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: RADIUS.md,
  border: BORDER_HAIRLINE,
  fontSize: 14,
  color: C.text,
  background: "#FFFFFF",
  outline: "none",
};
