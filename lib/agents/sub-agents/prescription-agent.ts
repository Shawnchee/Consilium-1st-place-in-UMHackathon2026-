/**
 * Prescription sub-agent (Haiku 4.5 + Tavily).
 *
 * Owns the Rx slice: extract structured prescription items from the doctor's
 * notes + dictation, and consult Tavily for drug-recall checks, species
 * contraindications (e.g. paracetamol in cats), or unfamiliar new agents.
 * The orchestrator merges the result into the final visit record.
 */

import { runSubAgent, type EmitToolSpec } from "./runner";
import type { PrescriptionCaptureOutput, SessionInput } from "./types";

const EMIT_TOOL: EmitToolSpec = {
  name: "emit_prescription",
  description:
    "Emit the structured prescription record for this consult. Call exactly once when done.",
  input_schema: {
    type: "object",
    properties: {
      prescription: {
        type: "array",
        items: {
          type: "object",
          properties: {
            drug: { type: "string" },
            dose: {
              type: "string",
              description: "e.g. '0.1 mg/kg PO BID' or '5 mg/kg SC once'.",
            },
            dur: {
              type: "string",
              description: "Duration, e.g. '7 days', '2 weeks'.",
            },
            qty: {
              type: "string",
              description: "Dispensed quantity, e.g. '14 tablets', '20 mL'.",
            },
          },
          required: ["drug", "dose", "dur", "qty"],
        },
      },
      warnings: {
        type: "array",
        description:
          "Drug-recall, interaction, or species-contraindication flags. Empty array if none.",
        items: { type: "string" },
      },
      tavilyNotes: {
        type: "string",
        description:
          "One short sentence summarising any Tavily search you ran. Empty string if no search.",
      },
    },
    required: ["prescription", "warnings", "tavilyNotes"],
  },
};

const SYSTEM_PROMPT = `You are the PRESCRIPTION sub-agent in a parallel multi-agent consultation pipeline. Your single job is to capture the prescription with structured fields and surface any safety flags before the orchestrator assembles the visit record.

You MUST call emit_prescription exactly once.

Extraction rules:
  1. Every drug mentioned with a dose / route / duration becomes a prescription row.
  2. Always include route + frequency in the dose field (PO BID, SC SID, IM once, etc.).
  3. If the doctor wrote "as needed" / PRN, set dur="PRN" and qty="dispense X tablets" with a sane default.
  4. NEVER invent drugs the doctor did not mention.

You have ONE tavily_search call available. Use it ONLY when:
  - The drug is one you are not confident is currently safe for this species at this dose (e.g. NSAIDs in cats, ivermectin in collies), OR
  - You suspect a recent (last 90 days) recall or safety alert may apply.
DO NOT search for well-known mainstream veterinary drugs in routine ranges. Skip the search if nothing in the prescription is unusual — that is the common case.

If you find a recall / contraindication / interaction, add a one-line warning to the warnings array. Keep tavilyNotes to one short sentence.`.trim();

function fallback(): PrescriptionCaptureOutput {
  return {
    prescription: [],
    warnings: [],
    tavilyNotes: "",
  };
}

function buildUserMessage(input: SessionInput): string {
  return [
    `Patient: ${input.patientName} (${input.patientSpecies ?? "unknown species"}, ${input.patientBreed ?? "unknown breed"})`,
    input.diagnosisHint ? `Working diagnosis: ${input.diagnosisHint}` : null,
    "",
    "DOCTOR NOTES:",
    input.notes || "(none)",
    "",
    input.transcript ? `DICTATION TRANSCRIPT:\n${input.transcript}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runPrescriptionAgent(input: SessionInput) {
  return runSubAgent<PrescriptionCaptureOutput>({
    agentName: "prescription",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserMessage(input),
    emitTool: EMIT_TOOL,
    enableTavily: true,
    fallback,
  });
}
