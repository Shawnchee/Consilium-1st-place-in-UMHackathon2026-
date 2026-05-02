"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, Icon } from "@/components/atoms";
import { PageHeader, SectionTitle } from "@/components/app-shell/page-header";
import { useStore } from "@/components/app-shell/store";
import {
  BORDER_HAIRLINE,
  C,
  FONT_MONO,
  FONT_SERIF,
  RADIUS,
} from "@/lib/tokens";
import { CLINIC } from "@/lib/clinic";
import { api } from "@/lib/api";
import { buildIdentityPayload } from "@/lib/passport-fixtures";
import type { PassportPayload } from "@/lib/types";

/* ------------------------------------------------------------------
   Identity row — two-column labeled list (mono label small caps +
   value in regular / serif). Hairline bottom divider, no wash.
   ------------------------------------------------------------------ */
function IdentityRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: 16,
        padding: "10px 0",
        borderBottom: last ? "none" : `1px solid ${C.borderSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: C.muted,
          paddingTop: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: C.text,
          fontFamily: mono ? FONT_MONO : "inherit",
          fontWeight: mono ? 500 : 400,
          lineHeight: 1.45,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Section heading — small caps, serif-free, used inside the booklet
   to separate sections. Hairline rule beneath.
   ------------------------------------------------------------------ */
function BookletSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "26px 0 8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: `1px solid ${C.borderSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: C.ink,
          }}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------
   Empty-state hint — used when a section has no data yet (e.g. a
   patient with no vaccinations or no diagnosis on record).
   ------------------------------------------------------------------ */
function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 0 4px",
        fontSize: 13,
        color: C.muted,
        fontStyle: "italic",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------
   Vaccination status — small dot + label. No wash background.
   ------------------------------------------------------------------ */
function VaxStatus({
  kind,
}: {
  kind: "ok" | "due" | "overdue";
}) {
  const map = {
    ok: { color: C.green, label: "Up to date", glyph: "●" },
    due: { color: C.amber, label: "Due soon", glyph: "●" },
    overdue: { color: C.red, label: "Overdue", glyph: "●" },
  } as const;
  const m = map[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 13,
        fontWeight: 600,
        color: m.color,
      }}
    >
      <span style={{ fontSize: 9, lineHeight: 1 }}>{m.glyph}</span>
      {m.label}
    </span>
  );
}

/* ------------------------------------------------------------------
   Real QR — encodes the absolute passport URL so any vet can scan it
   and land on the same public page. Rendered at 220px inside a white
   card frame with a hairline border.
   ------------------------------------------------------------------ */
function PassportQR({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        padding: 10,
        borderRadius: RADIUS.lg,
        background: "#FFFFFF",
        border: BORDER_HAIRLINE,
        display: "grid",
        placeItems: "center",
      }}
    >
      {value ? (
        <QRCodeSVG
          value={value}
          size={size - 20}
          level="M"
          fgColor="#0F172A"
          bgColor="#FFFFFF"
        />
      ) : (
        <div style={{ fontSize: 11, color: C.muted }}>Loading…</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Visit timeline row — hairline divider, date in mono.
   ------------------------------------------------------------------ */
function VisitRow({
  date,
  reason,
  outcome,
  first,
}: {
  date: string;
  reason: string;
  outcome: string;
  first?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderTop: first ? "none" : `1px solid ${C.borderSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.hint,
          fontFamily: FONT_MONO,
          letterSpacing: 0.2,
        }}
      >
        {date}
      </div>
      <div style={{ fontSize: 13, color: C.text, marginTop: 3, fontWeight: 500 }}>
        {reason}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{outcome}</div>
    </div>
  );
}

function PassportContent() {
  const params = useSearchParams();
  const pid = params.get("pid");
  const { flashToast, patients } = useStore();
  const milo = patients.find((x) => x.id === "p1") || patients[0];
  const p = patients.find((x) => x.id === pid) || milo;

  const targetId = pid ?? p?.id ?? null;

  // Resolved passport payload — fetched from the API; falls back to a
  // patient-identity-only payload if the API is slow or errors.
  const [payload, setPayload] = useState<PassportPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    setPayload(null);
    setLoadError(null);
    api
      .getPassport(targetId)
      .then((res) => {
        if (!cancelled) setPayload(res.payload);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load passport");
        if (p) setPayload(buildIdentityPayload(p));
      });
    return () => {
      cancelled = true;
    };
  }, [targetId, p]);

  if (!p || !payload) {
    return (
      <div style={{ padding: 48, color: C.muted, fontSize: 14 }}>
        Loading passport…
      </div>
    );
  }

  const absolutePassportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/passport?pid=${encodeURIComponent(p.id)}`
      : `/passport?pid=${encodeURIComponent(p.id)}`;
  const displayUrl = absolutePassportUrl.replace(/^https?:\/\//, "");

  const copyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(absolutePassportUrl).catch(() => {});
    }
    flashToast(`Passport link copied · ${p.name}`);
  };

  const vaccinations = payload.vaccinations;
  const visits = payload.visits;

  return (
    <div style={{ padding: "0 32px 100px", maxWidth: 1480, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Pet health passport"
        title={`${p.name}'s health passport`}
        sub="Clinic-side preview of the owner's shareable record. Any vet can open it without login."
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" icon={Icon.back(14)}>
                Back
              </Button>
            </Link>
            <Button
              variant="soft"
              size="sm"
              icon={Icon.download(14)}
              onClick={() => flashToast("Generating PDF — this is a preview")}
            >
              Download PDF
            </Button>
            <Button size="sm" onClick={copyLink}>
              Copy share link
            </Button>
          </div>
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: -12,
          marginBottom: 24,
          fontSize: 12.5,
          color: C.muted,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: C.hint,
          }}
        >
          Preview
        </span>
        <span style={{ color: C.hint }}>·</span>
        <span>Public at</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: C.ink,
            background: "#FFFFFF",
            padding: "2px 8px",
            border: BORDER_HAIRLINE,
            borderRadius: 4,
          }}
        >
          {displayUrl}
        </span>
        {loadError && (
          <span style={{ fontSize: 11, color: C.amber }}>
            · using local fallback ({loadError})
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 32,
          alignItems: "start",
        }}
      >
        {/* --------- BOOKLET (document area) --------- */}
        <Card
          style={{
            padding: 0,
            overflow: "hidden",
            maxWidth: 820,
            width: "100%",
            justifySelf: "center",
            animation: "fadeUp 420ms ease both",
          }}
        >
          {/* Booklet header strip — no wash, hairline divider */}
          <div
            style={{
              padding: "40px 56px 28px",
              borderBottom: `1px solid ${C.borderSoft}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 30,
                  lineHeight: 1,
                  filter: "grayscale(0.15)",
                }}
                aria-hidden
              >
                🐾
              </span>
              <h1
                style={{
                  margin: 0,
                  fontFamily: FONT_SERIF,
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: -0.8,
                  color: C.text,
                  lineHeight: 1.05,
                }}
              >
                {p.name}&apos;s Health Passport
              </h1>
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                letterSpacing: 0.2,
                fontFamily: FONT_MONO,
              }}
            >
              {CLINIC.name} · Updated {payload.generatedAt}
            </div>
          </div>

          {/* Body — generous margins, editorial spacing */}
          <div style={{ padding: "14px 56px 48px" }}>
            {/* Pet identity block */}
            <BookletSection title="Pet identity">
              <div style={{ padding: "4px 0" }}>
                <IdentityRow
                  label="Name"
                  value={
                    <span style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 600 }}>
                      {p.name}
                    </span>
                  }
                />
                <IdentityRow label="Species" value={p.species} />
                <IdentityRow label="Breed" value={p.breed} />
                <IdentityRow label="Age" value={p.age} />
                <IdentityRow label="Sex" value={p.sex} />
                {payload.identity.microchipId && (
                  <IdentityRow
                    label="Microchip ID"
                    value={payload.identity.microchipId}
                    mono
                  />
                )}
                <IdentityRow
                  label="Owner"
                  value={
                    <>
                      {p.owner}
                      <span
                        style={{
                          color: C.muted,
                          fontSize: 12,
                          marginLeft: 8,
                          fontFamily: FONT_MONO,
                        }}
                      >
                        {p.ownerPhone}
                      </span>
                    </>
                  }
                  last
                />
              </div>
            </BookletSection>

            {/* Vaccinations */}
            <BookletSection title="Vaccinations">
              {vaccinations.length === 0 ? (
                <EmptyHint>No vaccinations on record yet.</EmptyHint>
              ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    {["Vaccine", "Last given", "Next due", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                          color: C.muted,
                          padding: "6px 8px 10px 0",
                          borderBottom: `1px solid ${C.borderSoft}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vaccinations.map((v, i) => (
                    <tr key={v.name}>
                      <td
                        style={{
                          padding: "11px 8px 11px 0",
                          borderBottom:
                            i === vaccinations.length - 1
                              ? "none"
                              : `1px solid ${C.borderSoft}`,
                          color: C.text,
                          fontWeight: 500,
                        }}
                      >
                        {v.name}
                      </td>
                      <td
                        style={{
                          padding: "11px 8px",
                          borderBottom:
                            i === vaccinations.length - 1
                              ? "none"
                              : `1px solid ${C.borderSoft}`,
                          color: C.muted,
                          fontFamily: FONT_MONO,
                          fontSize: 12.5,
                        }}
                      >
                        {v.last}
                      </td>
                      <td
                        style={{
                          padding: "11px 8px",
                          borderBottom:
                            i === vaccinations.length - 1
                              ? "none"
                              : `1px solid ${C.borderSoft}`,
                          color: C.muted,
                          fontFamily: FONT_MONO,
                          fontSize: 12.5,
                        }}
                      >
                        {v.next}
                      </td>
                      <td
                        style={{
                          padding: "11px 0",
                          borderBottom:
                            i === vaccinations.length - 1
                              ? "none"
                              : `1px solid ${C.borderSoft}`,
                        }}
                      >
                        <VaxStatus kind={v.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </BookletSection>

            {/* Active medications */}
            <BookletSection title="Active medications">
              {payload.activeMeds.length === 0 ? (
                <EmptyHint>No active medications.</EmptyHint>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 12,
                    padding: "4px 0 6px",
                  }}
                >
                  {payload.activeMeds.map((med, idx) => (
                    <div
                      key={`${med.drug}-${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 16,
                        padding: "10px 0",
                        borderTop:
                          idx === 0 ? "none" : `1px solid ${C.borderSoft}`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: FONT_MONO,
                            fontSize: 14,
                            fontWeight: 700,
                            color: C.text,
                            letterSpacing: 0.2,
                          }}
                        >
                          {med.drug}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: C.muted,
                            marginTop: 4,
                          }}
                        >
                          {med.dose}
                        </div>
                      </div>
                      {(med.progressLabel || med.endsLabel) && (
                        <div style={{ textAlign: "right", minWidth: 140 }}>
                          {med.progressLabel && (
                            <div
                              style={{
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: 1.2,
                                color: C.muted,
                                fontWeight: 700,
                              }}
                            >
                              {med.progressLabel}
                            </div>
                          )}
                          {typeof med.progress === "number" && (
                            <div
                              style={{
                                marginTop: 8,
                                height: 2,
                                background: C.borderSoft,
                                borderRadius: 2,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.max(0, Math.min(1, med.progress)) * 100}%`,
                                  height: "100%",
                                  background: C.text,
                                }}
                              />
                            </div>
                          )}
                          {med.endsLabel && (
                            <div
                              style={{
                                fontSize: 11,
                                color: C.hint,
                                marginTop: 6,
                                fontFamily: FONT_MONO,
                              }}
                            >
                              {med.endsLabel}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </BookletSection>

            {/* Last diagnosis */}
            <BookletSection title="Last diagnosis">
              {payload.lastDiagnosis ? (
                <div style={{ padding: "4px 0 8px" }}>
                  <div
                    style={{
                      fontFamily: FONT_SERIF,
                      fontSize: 18,
                      fontWeight: 600,
                      color: C.text,
                      letterSpacing: -0.2,
                    }}
                  >
                    {payload.lastDiagnosis.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: C.muted,
                      marginTop: 6,
                      lineHeight: 1.55,
                    }}
                  >
                    {payload.lastDiagnosis.detail}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.hint,
                      marginTop: 10,
                      fontFamily: FONT_MONO,
                      letterSpacing: 0.2,
                    }}
                  >
                    {payload.lastDiagnosis.bylineDoctor} ·{" "}
                    {payload.lastDiagnosis.bylineDate}
                  </div>
                </div>
              ) : (
                <EmptyHint>No diagnosis on record yet.</EmptyHint>
              )}
            </BookletSection>

            {/* Notes for next vet — italic serif, hairline block */}
            {payload.notesForNextVet && (
              <BookletSection title="Notes for next vet">
                <blockquote
                  style={{
                    margin: "6px 0 4px",
                    padding: "14px 20px",
                    borderLeft: `2px solid ${C.border}`,
                    borderTop: `1px solid ${C.borderSoft}`,
                    borderRight: `1px solid ${C.borderSoft}`,
                    borderBottom: `1px solid ${C.borderSoft}`,
                    borderRadius: 2,
                    fontFamily: FONT_SERIF,
                    fontStyle: "italic",
                    fontSize: 15,
                    color: C.ink,
                    lineHeight: 1.6,
                    background: "#FFFFFF",
                  }}
                >
                  {payload.notesForNextVet}
                </blockquote>
              </BookletSection>
            )}

            {/* Emergency contact */}
            <BookletSection title="Emergency contact">
              <div style={{ padding: "6px 0 2px" }}>
                <div
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 16,
                    fontWeight: 600,
                    color: C.text,
                  }}
                >
                  {CLINIC.name}
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    color: C.ink,
                    marginTop: 4,
                  }}
                >
                  {CLINIC.phone}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  Open daily 9am – 9pm · 24h emergency line available
                </div>
              </div>
            </BookletSection>
          </div>

          {/* Footer colophon — mono */}
          <div
            style={{
              padding: "16px 56px",
              borderTop: `1px solid ${C.borderSoft}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
              fontFamily: FONT_MONO,
              color: C.hint,
              letterSpacing: 0.2,
            }}
          >
            <span>consilium · passport {payload.shareUuid}</span>
            <span>page 1 of 1</span>
          </div>
        </Card>

        {/* --------- SIDEBAR --------- */}
        <div
          style={{
            display: "grid",
            gap: 20,
            alignContent: "start",
            animation: "fadeUp 500ms ease both",
            animationDelay: "80ms",
          }}
        >
          {/* QR card */}
          <Card style={{ padding: 24 }}>
            <SectionTitle title="Share passport" />
            <div
              style={{
                display: "grid",
                placeItems: "center",
                padding: "4px 0 18px",
              }}
            >
              <PassportQR value={absolutePassportUrl} size={220} />
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11.5,
                color: C.ink,
                textAlign: "center",
                wordBreak: "break-all",
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              {displayUrl}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <Button size="md" style={{ width: "100%" }} onClick={copyLink}>
                Copy link
              </Button>
              <Button
                variant="soft"
                size="md"
                style={{ width: "100%" }}
                icon={Icon.download(14)}
                onClick={() => flashToast("Generating PDF — this is a preview")}
              >
                Download PDF
              </Button>
            </div>
          </Card>

          {/* Recent visits timeline */}
          <Card style={{ padding: 24 }}>
            <SectionTitle title="Recent visits" count={visits.length} />
            <div>
              {visits.map((v, i) => (
                <VisitRow
                  key={v.date}
                  date={v.date}
                  reason={v.reason}
                  outcome={v.outcome}
                  first={i === 0}
                />
              ))}
            </div>
          </Card>

          {/* Why this matters — quiet editorial block */}
          <Card style={{ padding: 24 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 1.8,
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 12,
              }}
            >
              Why this matters
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: FONT_SERIF,
                fontSize: 14,
                lineHeight: 1.6,
                color: C.ink,
              }}
            >
              Organic marketing — any vet who scans the QR sees Consilium.
              Solves lost paper vaccination cards. The passport updates itself
              after every visit, so owners never hand over a stale record again.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PassportPage() {
  return (
    <Suspense>
      <PassportContent />
    </Suspense>
  );
}
