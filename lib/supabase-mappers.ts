/**
 * DB row → domain type mappers.
 *
 * The DB stores canonical facts (name, species, owner, etc.). Display-only
 * fields (time slot, tag pill, reason, and the pre-consult brief) are not
 * yet DB-backed — they'll come from an appointments table + GLM in Phase 6.
 * Until then we overlay them from `lib/data.ts` by patient name so the
 * dashboard keeps its polished look.
 */
import { PATIENTS } from "./data";
import type {
  Brief,
  ConversationTurn,
  FollowUp,
  FollowUpLevel,
  Patient,
  TagColor,
} from "./types";

export type PatientRow = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  age_years: number | null;
  sex: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_telegram: string | null;
  reason_for_visit: string | null;
};

const EMPTY_BRIEF: Brief = {
  lastVisit: "No prior visits on record",
  chronic: "—",
  compliance: "—",
  pending: "—",
  probe: "—",
};

const briefByName = new Map(PATIENTS.map((p) => [p.name, p.brief]));
const displayByName = new Map(
  PATIENTS.map((p) => [
    p.name,
    { time: p.time, tag: p.tag, tagColor: p.tagColor, reason: p.reason },
  ]),
);

export function rowToPatient(r: PatientRow): Patient {
  const display = displayByName.get(r.name);
  return {
    id: r.id,
    name: r.name,
    species: r.species ?? "Unknown",
    breed: r.breed ?? "",
    age: r.age_years != null ? `${r.age_years}yo` : "",
    sex: r.sex ?? "",
    owner: r.owner_name ?? "",
    ownerPhone: r.owner_phone ?? "",
    time: display?.time ?? "—",
    tag: display?.tag ?? "Scheduled",
    tagColor: (display?.tagColor as TagColor) ?? "green",
    reason: r.reason_for_visit ?? display?.reason ?? "",
    brief: briefByName.get(r.name) ?? EMPTY_BRIEF,
  };
}

export function briefForPatient(r: PatientRow): Brief {
  return briefByName.get(r.name) ?? EMPTY_BRIEF;
}

// ─── follow-ups ──────────────────────────────────────────────────────────────
export type FollowupRow = {
  id: string;
  status: string;
  owner_message: string | null;
  recommended_action: string | null;
  draft_response: string | null;
  differentials: unknown;
  conversation: unknown;
  tool_call_count: number | null;
  sent_at: string | null;
  created_at: string;
  telegram_chat_id: string | null;
  visits: {
    visit_date: string;
    raw_notes: string | null;
    patients: { id: string; name: string; owner_name: string | null } | null;
  } | null;
};

const RESOLVED_STATUSES = new Set(["clear", "resolved", "all_clear"]);

export function isResolvedStatus(s: string): boolean {
  return RESOLVED_STATUSES.has(s);
}

function toLevel(status: string): FollowUpLevel {
  if (status === "escalate") return "escalate";
  if (status === "monitor") return "monitor";
  return "clear";
}

function parseDifferentials(raw: unknown): FollowUp["differentials"] {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((d) => {
      if (!d || typeof d !== "object") return null;
      const o = d as Record<string, unknown>;
      const cause = typeof o.cause === "string" ? o.cause : null;
      const prob =
        typeof o.probability === "number"
          ? o.probability
          : typeof o.prob === "number"
            ? o.prob
            : null;
      const tone = o.tone === "red" ? "red" : "green";
      if (!cause || prob == null) return null;
      return { cause, prob, tone } as const;
    })
    .filter((x): x is { cause: string; prob: number; tone: "red" | "green" } =>
      Boolean(x),
    );
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const ms = Date.now() - then;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function procedureFromNotes(notes: string | null): string {
  if (!notes) return "Follow-up";
  // First clause before period/comma, capped.
  const head = notes.split(/[.,]/)[0]?.trim() ?? notes.trim();
  return head.length > 60 ? head.slice(0, 57) + "…" : head;
}

const VALID_ROLES = new Set(["owner", "bot_tool", "bot_decision"]);

function parseConversation(raw: unknown): ConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is ConversationTurn =>
      t !== null &&
      typeof t === "object" &&
      "role" in t &&
      typeof (t as { role: unknown }).role === "string" &&
      VALID_ROLES.has((t as { role: string }).role),
  );
}

export function rowToFollowUp(r: FollowupRow): FollowUp {
  const visit = r.visits;
  const patient = visit?.patients;
  return {
    id: r.id,
    level: toLevel(r.status),
    patient: patient?.name ?? "Unknown",
    procedure: procedureFromNotes(visit?.raw_notes ?? null),
    owner: patient?.owner_name ?? "",
    daysPost: daysSince(visit?.visit_date ?? null),
    ownerMessage: r.owner_message ?? "",
    differentials: parseDifferentials(r.differentials),
    recommendation: r.recommended_action ?? "",
    draft: r.draft_response ?? undefined,
    tsLabel: undefined,
    conversation: parseConversation(r.conversation),
    toolCallCount: r.tool_call_count ?? 0,
    chatId: r.telegram_chat_id ?? undefined,
    patientId: patient?.id ?? undefined,
  };
}
