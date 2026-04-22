/**
 * Canned GLM outputs. Called from lib/glm.ts in mock mode. Shapes mirror the
 * production contracts exactly so the Phase 5-real swap needs no caller
 * changes.
 *
 * Triage fixture returns either:
 *   - a `tool_call` on the first ambiguous turn — the agent wants more info
 *     before deciding (M10a). Caller feeds the tool's `ownerPrompt` to the
 *     owner and waits for the reply.
 *   - a `decision` — terminal verdict. Used on turn 2 (after the owner's
 *     clarifying reply), or turn 1 if the signal is strong enough to skip
 *     info gathering.
 */

import { GLM_CONSULT_OUTPUT, PATIENTS } from "./data";
import type {
  Brief,
  ConsultOutput,
  Differential,
  FollowUpLevel,
  ToolName,
} from "./types";
import type { CallGLMParams } from "./glm";

export interface TriageDecision {
  kind: "decision";
  decision: FollowUpLevel;
  confidence: number;
  differentials: Differential[];
  recommendedAction: string;
  ownerReplyDraft: string;
  doctorSummary: string;
  reasoning: string;
}

export interface TriageToolCall {
  kind: "tool_call";
  tool: ToolName;
  args: Record<string, unknown>;
  reasoning: string;
  ownerPrompt: string;
}

export type TriageFixtureOutput = TriageDecision | TriageToolCall;

/* ─── keyword sets ──────────────────────────────────────────────────────── */

const STRONG_ESCALATE = [
  "seizure",
  "collapse",
  "not breathing",
  "unconscious",
  "vomit blood",
  "vomiting blood",
  "convulsing",
];
const STRONG_CLEAR = [
  "back to normal",
  "back to his",
  "back to her",
  "eating well",
  "eating like",
  "playful",
  "perfect",
  "all good",
  "full recovery",
  "thanks doc",
];
// Ambiguous-but-visual: agent should request a photo first.
const PHOTO_TRIGGERS = [
  "blood",
  "bleeding",
  "swollen",
  "swelling",
  "wound",
  "incision",
  "red",
  "oozing",
  "discharge",
];
// Ambiguous-but-behavioural: agent should ask about appetite/energy window.
const APPETITE_TRIGGERS = [
  "quiet",
  "tired",
  "slow",
  "lethargic",
  "not interested",
  "off food",
  "won't eat",
  "wont eat",
  "not eating",
  "less energy",
];
// Ambiguous-but-systemic: agent should ask for a temperature reading.
const TEMP_TRIGGERS = [
  "hot",
  "warm",
  "shivering",
  "trembling",
  "shaking",
  "fever",
  "feverish",
  "panting",
];

function lower(s: string): string {
  return s.toLowerCase();
}
function hit(msg: string, words: string[]): boolean {
  const l = lower(msg);
  return words.some((w) => l.includes(w));
}

/* ─── tool-call catalog ─────────────────────────────────────────────────── */

const TOOL_CALLS: Record<
  ToolName,
  (patientName: string) => Pick<TriageToolCall, "args" | "reasoning" | "ownerPrompt">
> = {
  request_photo: (name) => ({
    args: { body_part: "affected area", reason: "rule out surgical wound breakdown vs superficial bleed" },
    reasoning:
      "Owner reports a visual symptom (blood / swelling / redness) without specifics. A photo differentiates incision breakdown from normal post-op oozing — which swings the decision between escalate and monitor.",
    ownerPrompt: `Thanks for letting us know about ${name}. Could you send a clear close-up photo of the area? Natural light works best. — PawsClinic KL`,
  }),
  request_temperature: (name) => ({
    args: { unit: "celsius" },
    reasoning:
      "Systemic signs (heat / tremor / panting) are non-specific. A temp reading partitions fever (> 39.5°C → escalate) vs stress/environment (normal → monitor).",
    ownerPrompt: `Thanks for the update on ${name}. If you have a thermometer handy, could you take her rectal or ear temperature and send me the reading? If not, no worries — just let me know. — PawsClinic KL`,
  }),
  request_appetite_timeline: (name) => ({
    args: { hours_window: 24 },
    reasoning:
      "Low-energy / anorexia reports need a time window. < 12 h and drinking = monitor; > 24 h and refusing water = escalate. Ask before deciding.",
    ownerPrompt: `Thanks for letting us know. How long has ${name} been off her food, and is she still drinking water? Any treats she'd normally go for that she's refusing? — PawsClinic KL`,
  }),
  request_medication_compliance: (name) => ({
    args: { drug: "prescribed course" },
    reasoning:
      "Persistent symptoms mid-treatment could be non-response OR missed doses. Confirm compliance before escalating to second-line drug.",
    ownerPrompt: `Has ${name} been getting every dose of her medication on schedule? Any missed or vomited doses? — PawsClinic KL`,
  }),
  schedule_doctor_callback: (name) => ({
    args: { urgency: "today" },
    reasoning:
      "Owner needs a human conversation — text triage can't capture what's being described.",
    ownerPrompt: `I'd like one of our vets to call you about ${name} shortly — is this a good number to reach you on in the next 30 minutes? — PawsClinic KL`,
  }),
};

/* ─── terminal decision builders ────────────────────────────────────────── */

function escalateDecision(
  reason: string,
  confidence: number,
  differentials: Differential[],
): TriageDecision {
  return {
    kind: "decision",
    decision: "escalate",
    confidence,
    differentials,
    recommendedAction: "Same-day recheck — photo + temperature if not already provided",
    ownerReplyDraft:
      "Thanks for letting us know. Based on what you're describing, we'd like to see them today. Could you come in at 2:30pm? If not, please call the clinic and we'll find a slot. — PawsClinic KL",
    doctorSummary: `Escalating: ${reason}`,
    reasoning: reason,
  };
}

function monitorDecision(reason: string): TriageDecision {
  return {
    kind: "decision",
    decision: "monitor",
    confidence: 0.74,
    differentials: [
      { cause: "Slow but expected recovery", prob: 0.7, tone: "green" },
      { cause: "Mild complication", prob: 0.3, tone: "red" },
    ],
    recommendedAction: "Continue care, check in tomorrow",
    ownerReplyDraft:
      "Thanks for the update — sounds like things are heading the right way. Keep up the current plan and we'll check back in tomorrow. — PawsClinic KL",
    doctorSummary: "Partial recovery — re-check in 24h.",
    reasoning: reason,
  };
}

function clearDecision(reason: string): TriageDecision {
  return {
    kind: "decision",
    decision: "clear",
    confidence: 0.92,
    differentials: [{ cause: "Normal recovery", prob: 0.95, tone: "green" }],
    recommendedAction: "Auto-reassurance, close case",
    ownerReplyDraft:
      "Wonderful news! Keep up the current care plan and reach out if anything changes. — PawsClinic KL",
    doctorSummary: "Owner reports normal recovery — case closed.",
    reasoning: reason,
  };
}

/* ─── main triage fixture ──────────────────────────────────────────────── */

export function triageFixture(params: CallGLMParams): TriageFixtureOutput {
  const msg = params.user ?? "";
  const toolCallCount = Number(params.context?.toolCallCount ?? 0);
  const patientName =
    (params.context?.patientName as string | undefined) ?? "your pet";

  // Strong signals go terminal on turn 1 — no point asking for a photo
  // of an actively seizing animal.
  if (hit(msg, STRONG_ESCALATE)) {
    return escalateDecision(
      `Strong red-flag keyword detected in message: "${msg}"`,
      0.88,
      [
        { cause: "Acute systemic emergency", prob: 0.85, tone: "red" },
        { cause: "Self-limiting event", prob: 0.15, tone: "green" },
      ],
    );
  }

  if (hit(msg, STRONG_CLEAR)) {
    return clearDecision("Owner explicitly reports full recovery / normal behaviour.");
  }

  // First turn + ambiguous signal → ask a clarifying tool call.
  if (toolCallCount === 0) {
    let tool: ToolName | null = null;
    if (hit(msg, PHOTO_TRIGGERS)) tool = "request_photo";
    else if (hit(msg, TEMP_TRIGGERS)) tool = "request_temperature";
    else if (hit(msg, APPETITE_TRIGGERS)) tool = "request_appetite_timeline";

    if (tool) {
      const spec = TOOL_CALLS[tool](patientName);
      return { kind: "tool_call", tool, ...spec };
    }
  }

  // Turn 2 (after a tool call) or anodyne message — commit to a decision.
  // Use combined conversation text when available so turn-2 sees the full
  // picture.
  const combined = lower(
    `${(params.context?.conversationText as string | undefined) ?? ""} ${msg}`,
  );

  if (
    /bleed|bloody|swollen|incision|stitches|heavy bleeding|worse|getting worse/.test(
      combined,
    )
  ) {
    return escalateDecision(
      "After clarifying turn, the follow-up answer confirms an actively evolving symptom (visible bleeding, stitches disturbed, or 'getting worse').",
      0.78,
      [
        { cause: "Post-procedure complication (wound / drug)", prob: 0.6, tone: "red" },
        { cause: "Normal recovery variability", prob: 0.4, tone: "green" },
      ],
    );
  }

  if (/39\.\d|40|fever|hot/.test(combined)) {
    return escalateDecision(
      "Temperature reading in the febrile range — systemic inflammatory response likely.",
      0.82,
      [
        { cause: "Post-op infection / systemic", prob: 0.7, tone: "red" },
        { cause: "Stress / environmental", prob: 0.3, tone: "green" },
      ],
    );
  }

  if (/back to|fine now|eating|playing|all good|thanks/.test(combined)) {
    return clearDecision("Clarifying reply indicates recovery is on track.");
  }

  return monitorDecision(
    "Ambiguous signal after info gathering — recovery slow but not deteriorating. Continue current plan, re-check in 24h.",
  );
}

/* ─── consult + brief fixtures (unchanged) ──────────────────────────────── */

export function consultFixture(_params: CallGLMParams): ConsultOutput {
  return GLM_CONSULT_OUTPUT;
}

const BRIEF_BY_NAME = new Map(PATIENTS.map((p) => [p.name, p.brief]));

export function briefFixture(params: CallGLMParams): Brief {
  const patientName =
    (params.context?.patientName as string | undefined) ?? "";
  const canned = BRIEF_BY_NAME.get(patientName);
  if (canned) return canned;
  return {
    lastVisit: `Most recent visit reviewed for ${patientName || "the patient"}`,
    chronic: "None on record",
    compliance: "Owner responsive to follow-ups",
    pending: "Annual vaccination status — confirm",
    probe: "Verify main complaint from today's intake",
  };
}
