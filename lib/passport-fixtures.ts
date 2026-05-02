/**
 * Passport seed data + helpers.
 *
 * - `MILO_DEMO_PAYLOAD` mirrors the previously hardcoded Milo cystotomy
 *   passport, used as the default returned by GET /api/passports/p1 in
 *   mock mode so the demo URL always renders something.
 * - `buildIdentityPayload` constructs a minimal payload for any patient
 *   when no real passport row exists yet (sections render empty rather
 *   than missing).
 * - `buildPayloadFromConsult` fuses a consult's SessionCaptureResult into
 *   a fresh payload for the close-case action.
 */

import type {
  PassportActiveMed,
  PassportLastDiagnosis,
  PassportPayload,
  PassportVaccination,
  PassportVisit,
  Patient,
} from "./types";
import type { SessionCaptureResult } from "./agents/sub-agents/types";

const MILO_VACCINATIONS: PassportVaccination[] = [
  { name: "DHPP", last: "15 May 2025", next: "May 2026", status: "ok" },
  { name: "Leptospirosis", last: "15 May 2025", next: "May 2026", status: "ok" },
  { name: "Rabies", last: "20 Aug 2024", next: "Aug 2025", status: "overdue" },
  { name: "Bordetella", last: "10 Mar 2025", next: "Mar 2026", status: "due" },
];

const MILO_VISITS: PassportVisit[] = [
  {
    date: "01 Dec 2025",
    reason: "Pre-cystotomy workup — haematuria + straining",
    outcome: "X-ray confirmed cystoliths · cystotomy booked 02 Dec",
  },
  {
    date: "24 Nov 2025",
    reason: "External clinic referral note (owner-reported)",
    outcome: "Amox-clav 7d + Urinary SO trial · symptoms persisted",
  },
  {
    date: "15 May 2025",
    reason: "Annual wellness exam",
    outcome: "DHPP + Lepto boosters · bloods normal",
  },
  {
    date: "10 Mar 2025",
    reason: "Bordetella vaccination",
    outcome: "No adverse reaction",
  },
  {
    date: "20 Aug 2024",
    reason: "Rabies vaccination + dental check",
    outcome: "Healthy · grade 1 tartar noted",
  },
];

const MILO_ACTIVE_MEDS: PassportActiveMed[] = [
  {
    drug: "Amoxicillin-clavulanate 250mg",
    dose: "12.5 mg/kg PO twice daily · with food",
    progressLabel: "Day 7 of 7",
    progress: 1,
    endsLabel: "Ends 01 Dec 2025",
  },
];

const MILO_LAST_DIAGNOSIS: PassportLastDiagnosis = {
  title: "Bladder stones — surgery scheduled",
  detail:
    "Cystolithiasis with secondary urolithiasis. Two large cystoliths nearly filling the bladder, plus smaller uroliths scattered along the urethra. Cystotomy scheduled for 02 Dec 2025.",
  bylineDate: "01 Dec 2025",
  bylineDoctor: "Dr. Amirah",
};

const MILO_NOTES_FOR_NEXT_VET =
  "Pre-cystotomy patient. Submit removed stones for analysis (likely struvite — failed medical dissolution despite 7-day antibiotic + Urinary SO trial at external clinic). Continue Urinary SO post-op pending lab result. Recheck UA at 2 + 6 weeks. Watch for urethral obstruction signs in the meantime — recurrent species/breed risk.";

export const MILO_DEMO_PAYLOAD: PassportPayload = {
  patientId: "p1",
  shareUuid: "9f3c-4a1e-milo-passport",
  generatedAt: "01 Dec 2025",
  identity: {
    name: "Milo",
    species: "Dog",
    breed: "Miniature Schnauzer",
    age: "8yo",
    sex: "Male (neutered)",
    owner: "Aisyah Rahman",
    ownerPhone: "+60 12 345 6789",
    microchipId: "985112007419283",
  },
  vaccinations: MILO_VACCINATIONS,
  visits: MILO_VISITS,
  activeMeds: MILO_ACTIVE_MEDS,
  lastDiagnosis: MILO_LAST_DIAGNOSIS,
  notesForNextVet: MILO_NOTES_FOR_NEXT_VET,
};

/**
 * Identity-only payload for a patient with no real passport yet.
 * Clinical sections come back empty so the page renders the patient's
 * identity row + clinic emergency contact and that's it.
 */
export function buildIdentityPayload(patient: Patient): PassportPayload {
  return {
    patientId: patient.id,
    shareUuid: shareUuidFor(patient.id),
    generatedAt: formatToday(),
    identity: identityFromPatient(patient),
    vaccinations: [],
    visits: [],
    activeMeds: [],
  };
}

/**
 * Build a fresh passport payload from the orchestrator's consult result.
 * Carries forward existing vaccinations + microchip from a prior payload
 * (passed in as `prior`) so they aren't lost on close-case.
 */
export function buildPayloadFromConsult(
  patient: Patient,
  result: SessionCaptureResult,
  prior?: PassportPayload | null,
): PassportPayload {
  const today = formatToday();
  const soap = result.summary.doctorSummary.soap;
  const aftercare = result.summary.ownerMessage.aftercare;
  const rx = result.summary.prescription;

  const newVisit: PassportVisit = {
    date: today,
    reason: shortReason(patient.reason || "Consultation"),
    outcome: truncate(soap.A, 220),
  };

  const visits = [newVisit, ...(prior?.visits ?? [])].slice(0, 12);

  const activeMeds: PassportActiveMed[] = rx.map((p) => ({
    drug: p.drug,
    dose: `${p.dose}${p.dur ? ` · ${p.dur}` : ""}`,
  }));

  const lastDiagnosis: PassportLastDiagnosis | undefined = soap.A
    ? {
        title: deriveDiagnosisTitle(soap.A),
        detail: soap.A,
        bylineDate: today,
        bylineDoctor: prior?.lastDiagnosis?.bylineDoctor ?? "Dr. Amirah",
      }
    : prior?.lastDiagnosis;

  const notesForNextVet =
    aftercare.length > 0 ? aftercare.join(" ") : prior?.notesForNextVet;

  return {
    patientId: patient.id,
    shareUuid: prior?.shareUuid ?? shareUuidFor(patient.id),
    generatedAt: today,
    identity: { ...identityFromPatient(patient), microchipId: prior?.identity.microchipId },
    vaccinations: prior?.vaccinations ?? [],
    visits,
    activeMeds,
    lastDiagnosis,
    notesForNextVet,
  };
}

function identityFromPatient(p: Patient) {
  return {
    name: p.name,
    species: p.species,
    breed: p.breed,
    age: p.age,
    sex: p.sex,
    owner: p.owner,
    ownerPhone: p.ownerPhone,
  };
}

function shareUuidFor(patientId: string): string {
  // Deterministic short slug from the patient id so the public URL stays
  // stable across re-generations. Not a security boundary — the URL is
  // meant to be shared.
  const safe = patientId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "passport";
  return `${safe}-passport`;
}

function formatToday(): string {
  // "01 Dec 2025" — matches the mono date style used elsewhere in the
  // booklet. Locale-stable so server + client agree.
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function shortReason(reason: string): string {
  return reason.length > 80 ? `${reason.slice(0, 77)}…` : reason;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function deriveDiagnosisTitle(assessment: string): string {
  // Use the first sentence (or first 80 chars) of the SOAP "A" line as a
  // headline — falls back to the full string if no sentence break.
  const firstSentence = assessment.split(/(?<=[.!?])\s/)[0] ?? assessment;
  return truncate(firstSentence, 80);
}
