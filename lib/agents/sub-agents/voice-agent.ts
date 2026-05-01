/**
 * Voice sub-agent (Haiku 4.5).
 *
 * Owns the dictation slice: takes the Deepgram transcript of the in-room
 * voice capture and mines it for owner-relayed information the typed notes
 * may miss — direct owner statements, reported symptoms, history, and
 * emotional tone (used by the orchestrator to set the right register on
 * the Telegram reply).
 *
 * Tavily is NOT exposed here — voice mining is purely linguistic.
 */

import { runSubAgent, type EmitToolSpec } from "./runner";
import type { SessionInput, VoiceCaptureOutput } from "./types";

const EMIT_TOOL: EmitToolSpec = {
  name: "emit_voice",
  description:
    "Emit the structured voice-capture analysis. Call exactly once when done.",
  input_schema: {
    type: "object",
    properties: {
      ownerStatements: {
        type: "array",
        description:
          "Direct quotes or close paraphrases of what the owner said in the dictation. Empty array if transcript has none.",
        items: { type: "string" },
      },
      reportedSymptoms: {
        type: "array",
        description: "Symptoms the owner reported (not doctor observations).",
        items: { type: "string" },
      },
      relevantHistory: {
        type: "array",
        description:
          "Relevant prior history the owner mentioned: previous episodes, diet changes, recent travel, exposure, missed doses.",
        items: { type: "string" },
      },
      emotionalTone: {
        type: "string",
        description:
          "One word capturing the owner's affect: 'worried', 'calm', 'frustrated', 'anxious', 'reassured'. Empty string if no clear tone.",
      },
    },
    required: ["ownerStatements", "reportedSymptoms", "relevantHistory", "emotionalTone"],
  },
};

const SYSTEM_PROMPT = `You are the VOICE sub-agent in a parallel multi-agent consultation pipeline. The clinic dictates each consult; you receive the raw Deepgram transcript and pull out everything the OWNER contributed that won't already be in the typed clinical notes.

You MUST call emit_voice exactly once.

Rules:
  1. ownerStatements = things the owner literally said. Include only the owner's voice, not the doctor's.
  2. reportedSymptoms = symptoms the owner described (vomiting, limping, coughing, etc.) — NOT the doctor's exam findings.
  3. relevantHistory = anything from the past that bears on the case: diet, supplements, prior issue, missed doses, recent kennel/travel/grooming.
  4. emotionalTone = a single word reflecting the owner's affect; the orchestrator uses this to set the right register on the Telegram reply.
  5. If the transcript is empty, sparse, or has no owner content, return empty arrays and emotionalTone="".

Be concise. Do not invent. Do not interpret medically.`.trim();

function fallback(): VoiceCaptureOutput {
  return {
    ownerStatements: [],
    reportedSymptoms: [],
    relevantHistory: [],
    emotionalTone: "",
  };
}

function buildUserMessage(input: SessionInput): string {
  return [
    `Patient: ${input.patientName} (${input.patientSpecies ?? "unknown"}, ${input.patientBreed ?? "unknown"})`,
    "",
    "DICTATION TRANSCRIPT:",
    input.transcript?.trim() || "(no transcript provided)",
  ].join("\n");
}

export async function runVoiceAgent(input: SessionInput) {
  return runSubAgent<VoiceCaptureOutput>({
    agentName: "voice",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserMessage(input),
    emitTool: EMIT_TOOL,
    fallback,
  });
}
