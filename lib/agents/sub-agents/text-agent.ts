/**
 * Text sub-agent (Haiku 4.5, multimodal).
 *
 * Owns the typed-notes + photos slice: reads the doctor's free-text notes
 * (and any uploaded photos via vision) to extract chief complaint,
 * structured observations, vitals, and a small set of differential
 * candidates. The orchestrator uses these to anchor the SOAP note.
 */

import { runSubAgent, type EmitToolSpec } from "./runner";
import type { SessionInput, TextCaptureOutput } from "./types";

const EMIT_TOOL: EmitToolSpec = {
  name: "emit_text",
  description:
    "Emit the structured analysis of the doctor's typed notes + any attached photos. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      chiefComplaint: {
        type: "string",
        description:
          "One short sentence: the primary reason the pet is in the clinic today.",
      },
      observations: {
        type: "array",
        description:
          "Doctor's clinical observations (exam findings, photo findings). Each item ≤ 20 words.",
        items: { type: "string" },
      },
      vitals: {
        type: "array",
        description:
          "Recorded vitals (only if the doctor wrote them). Empty array if none — do NOT invent.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "e.g. 'Temperature', 'HR', 'RR', 'Weight', 'BCS'.",
            },
            value: {
              type: "string",
              description: "e.g. '39.2°C', '120 bpm', '24 rpm', '8.4 kg', '5/9'.",
            },
          },
          required: ["name", "value"],
        },
      },
      diagnosisCandidates: {
        type: "array",
        description:
          "Working differentials, most likely first. 1-3 items. Empty array if notes are too sparse.",
        items: { type: "string" },
      },
    },
    required: ["chiefComplaint", "observations", "vitals", "diagnosisCandidates"],
  },
};

const SYSTEM_PROMPT = `You are the TEXT sub-agent in a parallel multi-agent consultation pipeline. You receive the doctor's typed notes and any attached photos, and produce the structured backbone the orchestrator turns into a SOAP note.

You MUST call emit_text exactly once.

Rules:
  1. chiefComplaint: one short sentence — the reason the patient is in today.
  2. observations: clinical observations from the doctor's notes AND from any photos provided. Be specific (location, side, colour, swelling, discharge, body language). Each ≤ 20 words.
  3. vitals: ONLY include vitals the doctor recorded. Do not invent.
  4. diagnosisCandidates: 1-3 working differentials, most likely first. Use the conventional veterinary names that match the BILLING_MATRIX keys when applicable (e.g. "otitis externa", "gastroenteritis", "atopic dermatitis", "dental disease", "ccl injury") so downstream agents match cleanly.
  5. If photos are provided, describe what you see clinically. DO NOT diagnose from images alone — flag findings for the vet's review.

You are an observation aid, not a medical device. Be precise, be brief, do not invent.`.trim();

function fallback(input: SessionInput): TextCaptureOutput {
  return {
    chiefComplaint: input.diagnosisHint || "Unspecified — see notes",
    observations: [],
    vitals: [],
    diagnosisCandidates: input.diagnosisHint ? [input.diagnosisHint] : [],
  };
}

function buildUserMessage(input: SessionInput): string {
  return [
    `Patient: ${input.patientName} (${input.patientSpecies ?? "unknown"}, ${input.patientBreed ?? "unknown"})`,
    input.diagnosisHint ? `Working diagnosis hint: ${input.diagnosisHint}` : null,
    "",
    "DOCTOR NOTES:",
    input.notes || "(none)",
    "",
    input.imageUrls && input.imageUrls.length > 0
      ? `(${input.imageUrls.length} photo${input.imageUrls.length === 1 ? "" : "s"} attached — describe clinical findings.)`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runTextAgent(input: SessionInput) {
  return runSubAgent<TextCaptureOutput>({
    agentName: "text",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserMessage(input),
    emitTool: EMIT_TOOL,
    images: input.imageUrls?.map((url) => ({ url })),
    fallback: () => fallback(input),
  });
}
