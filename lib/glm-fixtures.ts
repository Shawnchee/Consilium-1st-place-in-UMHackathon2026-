/**
 * Canned GLM outputs. Called from lib/glm.ts in mock mode. Shapes mirror the
 * production contracts exactly so the Phase 5-real swap needs no caller
 * changes.
 *
 * Triage fixture picks red-flag / monitor / clear via keyword match on the
 * owner message — keeps the demo deterministic and reproduces the prior
 * inline classifier in app/api/triage/route.ts.
 */

import { GLM_CONSULT_OUTPUT, PATIENTS } from "./data";
import type { Brief, ConsultOutput, FollowUpLevel } from "./types";
import type { Differential } from "./api-types";
import type { CallGLMParams } from "./glm";

export interface TriageFixtureOutput {
  decision: FollowUpLevel;
  confidence: number;
  differentials: Differential[];
  recommendedAction: string;
  ownerReplyDraft: string;
  doctorSummary: string;
}

const RED_FLAG = [
  "blood",
  "bleeding",
  "swollen",
  "swelling",
  "infected",
  "pus",
  "fever",
  "not moving",
  "won't eat",
  "wont eat",
  "lying there",
  "lethargic",
  "collapse",
  "seizure",
  "vomit",
];
const MONITOR_WORDS = [
  "soft",
  "a bit quiet",
  "slow",
  "scratching",
  "still a bit",
  "slightly",
  "mild",
];
const CLEAR_WORDS = [
  "great",
  "fine",
  "normal",
  "active",
  "eating well",
  "back to",
  "playful",
  "perfect",
  "thanks",
  "all good",
];

function hit(msg: string, words: string[]): boolean {
  const low = msg.toLowerCase();
  return words.some((w) => low.includes(w));
}

export function triageFixture(params: CallGLMParams): TriageFixtureOutput {
  const msg = params.user ?? "";

  if (hit(msg, RED_FLAG)) {
    return {
      decision: "escalate",
      confidence: 0.62,
      differentials: [
        { cause: "Post-procedure complication", probability: 0.6, tone: "red" },
        { cause: "Normal recovery variability", probability: 0.4, tone: "green" },
      ],
      recommendedAction: "Same-day recheck — photo + temperature first",
      ownerReplyDraft:
        "Thanks for letting us know. Please bring them in today so we can take a look — could you send a photo of the area first, and a temperature reading if you have a thermometer? — PawsClinic KL",
      doctorSummary: "Owner reports concerning symptoms — recommend recheck.",
    };
  }

  if (hit(msg, CLEAR_WORDS) && !hit(msg, MONITOR_WORDS)) {
    return {
      decision: "clear",
      confidence: 0.92,
      differentials: [
        { cause: "Normal recovery", probability: 0.95, tone: "green" },
      ],
      recommendedAction: "Auto-reassurance, close case",
      ownerReplyDraft:
        "Wonderful news! Keep up the current care plan and reach out if anything changes. — PawsClinic KL",
      doctorSummary: "Owner reports normal recovery — case closed.",
    };
  }

  return {
    decision: "monitor",
    confidence: 0.74,
    differentials: [
      { cause: "Slow but expected recovery", probability: 0.7, tone: "green" },
      { cause: "Mild complication", probability: 0.3, tone: "amber" },
    ],
    recommendedAction: "Continue care, check in tomorrow",
    ownerReplyDraft:
      "Thanks for the update — sounds like things are heading the right way. Keep up the current plan and we'll check back in tomorrow. — PawsClinic KL",
    doctorSummary: "Partial recovery — re-check in 24h.",
  };
}

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
