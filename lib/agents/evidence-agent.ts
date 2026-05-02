/**
 * Evidence agent — runs AFTER the main consult pipeline returns, never on
 * the critical path. Single Haiku 4.5 call with Tavily enabled, scoped to
 * one question: "Are there any recent (last 12 months) recalls, new
 * contraindications, or notable safety updates for the prescribed drugs
 * or the diagnosis in this species?"
 *
 * The 7-day Tavily cache (lib/tools/tavily.ts) makes repeat queries on
 * common drugs <50ms. First-ever queries take 8-15s but they happen off
 * the critical path so the doctor doesn't notice.
 *
 * Result is intentionally short: a status (clear / warning / unknown) and
 * one or two cited sentences. The UI renders this as a small banner under
 * the prescription card so investors see "AI is checking real-time
 * literature" without it slowing down the demo.
 */

import { runSubAgent, type EmitToolSpec } from "./sub-agents/runner";

export type EvidenceCheckStatus = "clear" | "warning" | "unknown";

export interface EvidenceCheckOutput {
  status: EvidenceCheckStatus;
  summary: string;
  citations: { title: string; url: string }[];
}

export interface EvidenceCheckInput {
  patientName: string;
  patientSpecies: string;
  diagnosis: string;
  drugs: string[];
}

const EMIT_TOOL: EmitToolSpec = {
  name: "emit_evidence_check",
  description:
    "Emit the structured evidence check result. Call exactly once when done.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["clear", "warning", "unknown"],
        description:
          "'clear' when no concerning findings, 'warning' for any recall / new contraindication / interaction worth surfacing, 'unknown' when the search returned nothing useful.",
      },
      summary: {
        type: "string",
        description:
          "One or two short sentences. For 'clear' — confirm what was checked. For 'warning' — name the issue and the affected drug/condition. Max 240 chars.",
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
          },
          required: ["title", "url"],
        },
      },
    },
    required: ["status", "summary", "citations"],
  },
};

const SYSTEM_PROMPT = `You are the EVIDENCE-CHECK agent. You run AFTER the main consult pipeline and have ONE job: cross-reference the prescribed drugs and the working diagnosis against the most recent veterinary literature for this species.

You MUST call emit_evidence_check exactly once.

Use Tavily exactly ONCE if needed. Frame your search like:
  - "<drug name> recall <species> 2024 2025"
  - "<diagnosis> new treatment guidelines <species> 2024 2025"

Return:
  - status="clear" when nothing concerning surfaced (this is the common case — say so, with the drugs you cleared).
  - status="warning" when you find a recent recall, new contraindication, dosing-range change, or notable interaction. Cite the source.
  - status="unknown" only when the search genuinely returned nothing useful at all.

Be terse. The doctor reads this in 3 seconds. No long preambles.`.trim();

function fallback(): EvidenceCheckOutput {
  return {
    status: "unknown",
    summary: "Evidence check unavailable — proceed with clinical judgment.",
    citations: [],
  };
}

function buildUserMessage(input: EvidenceCheckInput): string {
  const drugs = input.drugs.length > 0 ? input.drugs.join(", ") : "(none)";
  return [
    `Patient: ${input.patientName} (${input.patientSpecies})`,
    `Working diagnosis: ${input.diagnosis || "(unspecified)"}`,
    `Prescribed drugs: ${drugs}`,
    "",
    "Check for any recent recalls, new contraindications, or significant safety updates affecting these prescriptions or this diagnosis in this species.",
  ].join("\n");
}

export async function runEvidenceAgent(input: EvidenceCheckInput) {
  return runSubAgent<EvidenceCheckOutput>({
    agentName: "evidence",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserMessage(input),
    emitTool: EMIT_TOOL,
    enableTavily: true,
    fallback,
  });
}
