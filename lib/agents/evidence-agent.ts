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
  /** Breed e.g. "Golden Retriever", "DSH". Helps narrow breed-predisposed conditions. */
  breed?: string;
  /** Age string e.g. "8y", "4 months". Lifestage influences dosing/contraindications. */
  age?: string;
  /** Owner-reported chief complaint, e.g. "straining to urinate x2 days". */
  chiefComplaint?: string;
  /** Full SOAP "A" line — assessment incl. differentials. NOT truncated. */
  soapAssessment?: string;
  /** 1-2 lines of comorbidities or prior treatments worth weighing. */
  relevantHistory?: string;
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

const SYSTEM_PROMPT = `You are the EVIDENCE-CHECK agent. You run AFTER the main consult pipeline and have ONE job: cross-reference the prescribed drugs and the working diagnosis against the most recent veterinary literature for THIS specific patient context.

You MUST call emit_evidence_check exactly once.

You are given the full session context: species, breed, age, chief complaint, the SOAP assessment line, and any relevant comorbidities/prior treatments. WEIGHT the more specific context (breed predispositions, lifestage, comorbid conditions, prior treatment failures) when crafting your single Tavily query — a query that mentions a relevant comorbidity or breed-linked risk surfaces far better evidence than a bare "<drug> <species>".

Use Tavily exactly ONCE if needed. Frame your search clinically and SPECIFICALLY:
  - "<drug> <species> <comorbidity-or-breed-risk> 2025 2026" when a comorbidity/breed factor matters
  - "<diagnosis> <species> treatment guidelines 2025 2026" otherwise
  - DO NOT include the patient's name in the Tavily query — it kills cache hits and adds nothing.

Return:
  - status="clear" when nothing concerning surfaced (the common case — say so, naming the drugs you cleared and the patient-specific risk you considered).
  - status="warning" when you find a recent recall, new contraindication, dosing-range change, breed-specific risk, or notable interaction with the comorbidities listed. Cite the source.
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
  const signalment = [input.patientSpecies, input.breed, input.age]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const lines: string[] = [
    `Patient: ${input.patientName} (${signalment || input.patientSpecies})`,
  ];
  if (input.chiefComplaint?.trim()) {
    lines.push(`Chief complaint: ${input.chiefComplaint.trim()}`);
  }
  lines.push(`Working diagnosis: ${input.diagnosis || "(unspecified)"}`);
  if (input.soapAssessment?.trim() && input.soapAssessment.trim() !== input.diagnosis.trim()) {
    lines.push(`SOAP assessment (full): ${input.soapAssessment.trim()}`);
  }
  if (input.relevantHistory?.trim()) {
    lines.push(`Relevant history: ${input.relevantHistory.trim()}`);
  }
  lines.push(`Prescribed drugs: ${drugs}`);
  lines.push("");
  lines.push(
    "Check for any recent recalls, new contraindications, dosing changes, breed-specific risks, or interactions affecting these prescriptions for THIS patient's signalment, presentation, and comorbidities. Weight the more specific context when crafting your Tavily query — do NOT include the patient name in the query string.",
  );
  return lines.join("\n");
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
