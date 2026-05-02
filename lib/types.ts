import type { Tone } from "./tokens";

export type TagColor = "green" | "amber" | "red";

export interface Brief {
  lastVisit: string;
  chronic: string;
  compliance: string;
  pending: string;
  probe: string;
}

export interface Patient {
  id: string;
  time: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  sex: string;
  owner: string;
  ownerPhone: string;
  /** Telegram chat ID linked to this patient (numeric or @username). */
  ownerTelegram?: string | null;
  tag: string;
  tagColor: TagColor;
  reason: string;
  brief: Brief;
  owner_telegram?: string;
}

export type FollowUpLevel = "escalate" | "monitor" | "clear";

export interface Differential {
  cause: string;
  prob: number;
  tone: "red" | "green";
}

export type ToolName =
  | "request_photo"
  | "request_temperature"
  | "request_appetite_timeline"
  | "request_medication_compliance"
  | "schedule_doctor_callback";

/**
 * One turn in the triage conversation. Rendered as bubbles in the
 * escalation modal; also the canonical log the agent reasons over on
 * subsequent turns.
 */
export type ConversationTurn =
  | {
      role: "owner";
      text: string;
      ts: string;
      /** Public URLs of any photos the owner attached to this turn
       *  (downloaded from Telegram → owner-photos bucket). Used by the
       *  escalation modal to render thumbnails so the doctor sees what
       *  the owner saw. */
      photoUrls?: string[];
    }
  | {
      role: "bot_tool";
      tool: ToolName;
      args: Record<string, unknown>;
      reasoning: string;
      ownerPrompt: string;
      ts: string;
    }
  | {
      role: "bot_decision";
      decision: FollowUpLevel;
      confidence: number;
      differentials: Differential[];
      reply: string;
      ts: string;
    };

export interface FollowUp {
  id: string;
  level: FollowUpLevel;
  patient: string;
  procedure: string;
  owner: string;
  daysPost: number;
  ownerMessage: string;
  differentials?: Differential[];
  recommendation: string;
  draft?: string;
  tsLabel?: string;
  conversation?: ConversationTurn[];
  toolCallCount?: number;
  /** Telegram chat id of the owner — required for the doctor-approved send. */
  chatId?: string;
  /** Patient row id — required by /api/consult/telegram-send for owner_telegram backwrite. */
  patientId?: string;
}

export interface MetricCardData {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
}

export interface BillingItem {
  item: string;
  price: number;
  flagged: boolean;
  note: string;
}

export interface PrescriptionItem {
  drug: string;
  dose: string;
  dur: string;
  qty: string;
}

export interface TodoItem {
  task: string;
  who: string;
}

export interface SoapNote {
  S: string;
  O: string;
  A: string;
  P: string;
}

export interface ConsultOutput {
  soap: SoapNote;
  prescription: PrescriptionItem[];
  billing: BillingItem[];
  todos: TodoItem[];
}

export interface DiagnosisRow {
  label: string;
  count: number;
}

export interface CorrectionRow {
  date: string;
  feature: "Triage" | "Billing" | "Prescription";
  glm: string;
  fix: string;
  who: string;
}

// ─── Pet passport ──────────────────────────────────────────────────────────
export type VaxStatus = "ok" | "due" | "overdue";

export interface PassportVaccination {
  name: string;
  last: string;
  next: string;
  status: VaxStatus;
}

export interface PassportVisit {
  date: string;
  reason: string;
  outcome: string;
}

export interface PassportActiveMed {
  drug: string;
  dose: string;
  /** "Day 7 of 7" style label rendered on the right. */
  progressLabel?: string;
  /** 0..1 progress bar value. */
  progress?: number;
  endsLabel?: string;
}

export interface PassportLastDiagnosis {
  title: string;
  detail: string;
  bylineDate: string;
  bylineDoctor: string;
}

export interface PassportIdentity {
  name: string;
  species: string;
  breed: string;
  age: string;
  sex: string;
  owner: string;
  ownerPhone: string;
  microchipId?: string;
}

export interface PassportPayload {
  patientId: string;
  shareUuid: string;
  /** Display string e.g. "01 Dec 2025" — generated server-side at upsert time. */
  generatedAt: string;
  identity: PassportIdentity;
  vaccinations: PassportVaccination[];
  visits: PassportVisit[];
  activeMeds: PassportActiveMed[];
  lastDiagnosis?: PassportLastDiagnosis;
  /** Free-form italic blockquote shown to the next vet. */
  notesForNextVet?: string;
}
