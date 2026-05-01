/**
 * Billing sub-agent (Haiku 4.5 + Tavily).
 *
 * Owns the revenue-capture slice of the consult: extract billable line-items
 * from the doctor's free-text + dictation, cross-check against the clinic's
 * BILLING_MATRIX, flag anything mentioned but not yet on the bill (the #1
 * leak), and consult Tavily ONLY for unfamiliar or recently-introduced
 * procedures whose pricing the matrix doesn't cover.
 */

import { runSubAgent, type EmitToolSpec } from "./runner";
import type { BillingCaptureOutput, SessionInput } from "./types";
import { BILLING_MATRIX, billablesFor } from "../../billing-matrix";

const EMIT_TOOL: EmitToolSpec = {
  name: "emit_billing",
  description:
    "Emit the structured billing line-items for this consult. Call exactly once when done.",
  input_schema: {
    type: "object",
    properties: {
      billing: {
        type: "array",
        description:
          "Every billable item this consult should generate. Use clinic matrix prices when available; flag and price=0 otherwise.",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            price: { type: "number" },
            flagged: {
              type: "boolean",
              description:
                "true when the item appears in notes but is unpriced, unmatched in the matrix, or otherwise needs front-desk review.",
            },
            note: { type: "string" },
          },
          required: ["item", "price", "flagged", "note"],
        },
      },
      unmatched: {
        type: "array",
        description:
          "Procedures or supplies you couldn't price — front desk will set price manually.",
        items: { type: "string" },
      },
      tavilyNotes: {
        type: "string",
        description:
          "One short sentence summarising any Tavily search you ran. Empty string if no search was needed.",
      },
    },
    required: ["billing", "unmatched", "tavilyNotes"],
  },
};

const SYSTEM_PROMPT = `You are the BILLING sub-agent in a parallel multi-agent consultation pipeline. Your single job is to capture every billable line-item from this consult, before the orchestrator agent assembles the final summary.

You MUST call emit_billing exactly once.

You have the clinic billing matrix in your user message. Rules:
  1. For every diagnosis, procedure, drug, and supply mentioned in the notes/transcript, output a billing row.
  2. Use the matrix price when the item matches. If a mentioned item has no matrix entry, set price=0, flagged=true, and note="price not in matrix".
  3. ALWAYS include the consultation fee unless the notes say "no charge" or "complimentary".
  4. Set flagged=true for any line-item that is mentioned in the notes/transcript but the doctor did not explicitly bill — those are revenue leaks and the front desk needs to confirm.

You have ONE tavily_search call available. Use it ONLY when:
  - You encounter an unfamiliar procedure / device / drug not in the matrix and you want to confirm a current Malaysian-vet typical price band, OR
  - The doctor mentions a recent regulatory or insurance code change.
DO NOT search for routine items already in the matrix. Skip the search entirely if everything is already in the matrix — that is the common case.

Be precise. Keep notes short.`.trim();

function fallback(input: SessionInput): BillingCaptureOutput {
  const hint = (input.diagnosisHint ?? input.notes ?? "").toLowerCase();
  const matched = billablesFor(hint);
  if (matched.length > 0) {
    return {
      billing: matched.map((m) => ({
        item: m.item,
        price: m.price,
        flagged: false,
        note: "matrix",
      })),
      unmatched: [],
      tavilyNotes: "",
    };
  }
  return {
    billing: [
      { item: "Consultation fee", price: 50, flagged: false, note: "default" },
    ],
    unmatched: [],
    tavilyNotes: "",
  };
}

function buildUserMessage(input: SessionInput): string {
  const matrix = Object.entries(BILLING_MATRIX)
    .map(
      ([dx, items]) =>
        `- ${dx}:\n${items.map((i) => `    • ${i.item} — RM${i.price}`).join("\n")}`,
    )
    .join("\n");
  return [
    `Patient: ${input.patientName} (${input.patientSpecies ?? "unknown species"})`,
    input.diagnosisHint ? `Working diagnosis hint: ${input.diagnosisHint}` : null,
    "",
    "DOCTOR NOTES:",
    input.notes || "(none)",
    "",
    input.transcript
      ? `DICTATION TRANSCRIPT:\n${input.transcript}\n`
      : null,
    "CLINIC BILLING MATRIX (RM):",
    matrix,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runBillingAgent(input: SessionInput) {
  return runSubAgent<BillingCaptureOutput>({
    agentName: "billing",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserMessage(input),
    emitTool: EMIT_TOOL,
    enableTavily: true,
    fallback: () => fallback(input),
  });
}
