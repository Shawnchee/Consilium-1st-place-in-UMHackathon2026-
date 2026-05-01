/**
 * Staff to-dos sub-agent (Haiku 4.5).
 *
 * Owns the action-items slice: turns the consult notes + dictation into a
 * list of concrete tasks for clinic staff (front desk, vet tech, doctor
 * recheck), each with an owner role.
 */

import { runSubAgent, type EmitToolSpec } from "./runner";
import type { SessionInput, TodosCaptureOutput } from "./types";

const EMIT_TOOL: EmitToolSpec = {
  name: "emit_todos",
  description:
    "Emit the staff to-do list extracted from this consult. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description:
                "Imperative-form action: 'Call owner with biopsy result', 'Schedule recheck in 2 weeks', 'Order Apoquel 5.4mg'.",
            },
            who: {
              type: "string",
              description:
                "Role responsible: 'Front desk', 'Vet tech', 'Doctor', 'Owner'.",
            },
          },
          required: ["task", "who"],
        },
      },
    },
    required: ["todos"],
  },
};

const SYSTEM_PROMPT = `You are the STAFF TO-DOS sub-agent in a parallel multi-agent consultation pipeline. You read the consult notes and dictation, and emit the concrete follow-up actions clinic staff must take.

You MUST call emit_todos exactly once.

Rules:
  1. Each task is imperative ("Schedule recheck in 2 weeks", not "We should schedule a recheck").
  2. Each task has a who: "Front desk", "Vet tech", "Doctor", or "Owner".
  3. Cover at minimum: any explicit follow-up the doctor mentioned, any pending lab/imaging result that needs a callback, any owner education item, any inventory order.
  4. If the notes are sparse and there are no clear actions, return an empty array — DO NOT invent generic "monitor patient" tasks.
  5. Keep tasks short (≤ 15 words).`.trim();

function fallback(): TodosCaptureOutput {
  return { todos: [] };
}

function buildUserMessage(input: SessionInput): string {
  return [
    `Patient: ${input.patientName} (${input.patientSpecies ?? "unknown"})`,
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

export async function runTodosAgent(input: SessionInput) {
  return runSubAgent<TodosCaptureOutput>({
    agentName: "todos",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserMessage(input),
    emitTool: EMIT_TOOL,
    fallback,
  });
}
