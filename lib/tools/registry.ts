/**
 * Tool registry — what tools each feature exposes to Claude, and how they
 * are handled when invoked.
 *
 * Three handling modes:
 *
 *   - "server"  — server-side executor runs and the result is fed back to
 *                 the model in the same call (e.g. tavily_search).
 *   - "user"    — model is asking the human a question. The loop breaks
 *                 here; the caller persists conversation state and the
 *                 next owner reply re-enters with the prior turns.
 *   - "emit"    — the structured output. The tool's input IS the final
 *                 typed payload returned to the caller. Loop breaks here.
 */

import { tavilyTool, executeTavily, type TavilyArgs } from "./tavily";
import { hasTavily } from "../env";

export type ToolHandling = "server" | "user" | "emit";

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface RegisteredTool {
  spec: ToolSpec;
  handling: ToolHandling;
  executor?: (input: unknown) => Promise<unknown>;
}

/* ─── user-facing triage tools (clarifying questions to the owner) ──── */

const requestPhoto: RegisteredTool = {
  handling: "user",
  spec: {
    name: "request_photo",
    description:
      "Ask the owner for a photo of an affected area (wound, skin, eye, etc.). Use when the owner reports a visual symptom (bleeding, swelling, redness, discharge) without specifics.",
    input_schema: {
      type: "object",
      properties: {
        args: {
          type: "object",
          properties: {
            body_part: { type: "string" },
            reason: { type: "string" },
          },
          required: ["body_part", "reason"],
        },
        reasoning: { type: "string", description: "Clinical reason you need a photo before deciding." },
        ownerPrompt: { type: "string", description: "Friendly message to send to the owner." },
      },
      required: ["args", "reasoning", "ownerPrompt"],
    },
  },
};

const requestTemperature: RegisteredTool = {
  handling: "user",
  spec: {
    name: "request_temperature",
    description:
      "Ask the owner for a temperature reading. Use when systemic signs (heat, panting, tremor) are reported without quantification.",
    input_schema: {
      type: "object",
      properties: {
        args: {
          type: "object",
          properties: { unit: { type: "string", enum: ["celsius", "fahrenheit"] } },
          required: ["unit"],
        },
        reasoning: { type: "string" },
        ownerPrompt: { type: "string" },
      },
      required: ["args", "reasoning", "ownerPrompt"],
    },
  },
};

const requestAppetiteTimeline: RegisteredTool = {
  handling: "user",
  spec: {
    name: "request_appetite_timeline",
    description:
      "Ask how long the pet has been off food and whether they're still drinking water. Use for low-energy / anorexia reports.",
    input_schema: {
      type: "object",
      properties: {
        args: {
          type: "object",
          properties: { hours_window: { type: "number" } },
          required: ["hours_window"],
        },
        reasoning: { type: "string" },
        ownerPrompt: { type: "string" },
      },
      required: ["args", "reasoning", "ownerPrompt"],
    },
  },
};

const requestMedicationCompliance: RegisteredTool = {
  handling: "user",
  spec: {
    name: "request_medication_compliance",
    description:
      "Confirm the owner has been giving every dose on schedule. Use when symptoms persist mid-treatment.",
    input_schema: {
      type: "object",
      properties: {
        args: {
          type: "object",
          properties: { drug: { type: "string" } },
          required: ["drug"],
        },
        reasoning: { type: "string" },
        ownerPrompt: { type: "string" },
      },
      required: ["args", "reasoning", "ownerPrompt"],
    },
  },
};

const scheduleDoctorCallback: RegisteredTool = {
  handling: "user",
  spec: {
    name: "schedule_doctor_callback",
    description:
      "Offer the owner a phone callback from a vet. Use when the situation is too nuanced for text triage.",
    input_schema: {
      type: "object",
      properties: {
        args: {
          type: "object",
          properties: { urgency: { type: "string", enum: ["today", "this_week"] } },
          required: ["urgency"],
        },
        reasoning: { type: "string" },
        ownerPrompt: { type: "string" },
      },
      required: ["args", "reasoning", "ownerPrompt"],
    },
  },
};

/* ─── tavily server tool ────────────────────────────────────────────── */

const tavilyRegistered: RegisteredTool = {
  handling: "server",
  spec: tavilyTool,
  executor: async (input) => executeTavily(input as TavilyArgs),
};

/* ─── emit tools (structured outputs) ───────────────────────────────── */

const emitBrief: RegisteredTool = {
  handling: "emit",
  spec: {
    name: "emit_brief",
    description: "Emit the final 5-line pre-consult brief. Call this exactly once when ready.",
    input_schema: {
      type: "object",
      properties: {
        lastVisit: { type: "string", description: "Date + one-line summary of the most recent visit. ≤ 20 words." },
        chronic: { type: "string", description: "Known chronic conditions, or 'None'. ≤ 20 words." },
        compliance: { type: "string", description: "Adherence to prior care plans, or 'N/A'. ≤ 20 words." },
        pending: { type: "string", description: "Outstanding items (overdue vaccines, tests, rechecks). ≤ 20 words." },
        probe: { type: "string", description: "The single thing the doctor should verify today. ≤ 20 words." },
      },
      required: ["lastVisit", "chronic", "compliance", "pending", "probe"],
    },
  },
};

const emitConsult: RegisteredTool = {
  handling: "emit",
  spec: {
    name: "emit_consult",
    description: "Emit the structured consult record. Call this once when SOAP, Rx, billing, and todos are ready.",
    input_schema: {
      type: "object",
      properties: {
        soap: {
          type: "object",
          properties: {
            S: { type: "string" },
            O: { type: "string" },
            A: { type: "string" },
            P: { type: "string" },
          },
          required: ["S", "O", "A", "P"],
        },
        prescription: {
          type: "array",
          items: {
            type: "object",
            properties: {
              drug: { type: "string" },
              dose: { type: "string" },
              dur: { type: "string" },
              qty: { type: "string" },
            },
            required: ["drug", "dose", "dur", "qty"],
          },
        },
        billing: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              price: { type: "number" },
              flagged: { type: "boolean", description: "true if mentioned in notes but not yet billed (revenue-leak flag)." },
              note: { type: "string" },
            },
            required: ["item", "price", "flagged", "note"],
          },
        },
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task: { type: "string" },
              who: { type: "string" },
            },
            required: ["task", "who"],
          },
        },
      },
      required: ["soap", "prescription", "billing", "todos"],
    },
  },
};

const emitDecision: RegisteredTool = {
  handling: "emit",
  spec: {
    name: "emit_decision",
    description:
      "Emit the terminal triage decision. Call this when you have enough information to commit to escalate / monitor / clear.",
    input_schema: {
      type: "object",
      properties: {
        decision: { type: "string", enum: ["escalate", "monitor", "clear"] },
        confidence: { type: "number", description: "0..1" },
        differentials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cause: { type: "string" },
              prob: { type: "number" },
              tone: { type: "string", enum: ["red", "green"] },
            },
            required: ["cause", "prob", "tone"],
          },
        },
        recommendedAction: { type: "string" },
        ownerReplyDraft: { type: "string", description: "Friendly text to send to the owner via Telegram." },
        doctorSummary: { type: "string", description: "One-line summary for the doctor's dashboard card." },
        reasoning: { type: "string", description: "Clinical justification for the decision." },
        kind: { type: "string", enum: ["decision"], description: "Must be 'decision'." },
      },
      required: [
        "decision",
        "confidence",
        "differentials",
        "recommendedAction",
        "ownerReplyDraft",
        "doctorSummary",
        "reasoning",
        "kind",
      ],
    },
  },
};

/* ─── per-feature registries ────────────────────────────────────────── */

export type Feature = "brief" | "consult" | "triage";

export function registryFor(feature: Feature): RegisteredTool[] {
  const tools: RegisteredTool[] = [];
  switch (feature) {
    case "brief":
      tools.push(emitBrief);
      break;
    case "consult":
      if (hasTavily()) tools.push(tavilyRegistered);
      tools.push(emitConsult);
      break;
    case "triage":
      if (hasTavily()) tools.push(tavilyRegistered);
      tools.push(
        requestPhoto,
        requestTemperature,
        requestAppetiteTimeline,
        requestMedicationCompliance,
        scheduleDoctorCallback,
        emitDecision,
      );
      break;
  }
  return tools;
}

export function lookupTool(feature: Feature, name: string): RegisteredTool | undefined {
  return registryFor(feature).find((t) => t.spec.name === name);
}
