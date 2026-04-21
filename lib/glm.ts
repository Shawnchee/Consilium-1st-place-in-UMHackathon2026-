/**
 * GLM client — mock implementation.
 *
 * Signature is the one the real Z.AI wrapper will ship with. Routes call
 * `callGLM({feature, user, ...})` and get back a `CallGLMResult<T>`. When
 * the Phase 5-real swap happens, this module's body is replaced with a
 * fetch to Z.AI — callers need no change.
 *
 * Prompts (lib/prompts.ts) are imported here today even though the mock
 * doesn't use them at runtime, so bundling + lint already know about them.
 * That keeps the swap to one file.
 */

import {
  BRIEF_PROMPT,
  CONSULT_EXTRACTION_PROMPT,
  TRIAGE_PROMPT,
} from "./prompts";
import { briefFixture, consultFixture, triageFixture } from "./glm-fixtures";

export type GLMFeature = "brief" | "consult" | "triage";

export interface CallGLMParams {
  feature: GLMFeature;
  /** Override the default prompt template. If omitted, uses the feature's template from lib/prompts.ts. */
  system?: string;
  /** User content — patient notes, owner message, etc. */
  user: string;
  /** Parse the response as JSON. Structured features default to true. */
  json?: boolean;
  /** Extra context (patient metadata, few-shot corrections, etc.). */
  context?: Record<string, unknown>;
}

export interface CallGLMResult<T = unknown> {
  data: T;
  raw: string;
  model: string;
  latencyMs: number;
  source: "mock" | "glm";
}

const PROMPTS: Record<GLMFeature, string> = {
  brief: BRIEF_PROMPT,
  consult: CONSULT_EXTRACTION_PROMPT,
  triage: TRIAGE_PROMPT,
};

/**
 * Per-feature latency envelopes. Tuned to feel like real LLM work:
 *  - brief: short summary, fast
 *  - consult: heavy extraction, substantial wait so the "thinking" animation lands
 *  - triage: one decision, medium
 */
const LATENCY_MS: Record<GLMFeature, [number, number]> = {
  brief: [500, 900],
  consult: [1200, 2200],
  triage: [600, 1000],
};

function pickLatency(feature: GLMFeature): number {
  const [lo, hi] = LATENCY_MS[feature];
  return lo + Math.floor(Math.random() * (hi - lo));
}

export async function callGLM<T = unknown>(
  params: CallGLMParams,
): Promise<CallGLMResult<T>> {
  // System prompt is resolved here so the real swap can reuse the same
  // lookup. Kept as a named local so lint sees the import as used.
  const systemPrompt = params.system ?? PROMPTS[params.feature];
  void systemPrompt;

  if (params.context?.corrections) {
    // Phase 10-real will prepend these as few-shot. Stub log today.
    console.log(
      `[glm:mock] would inject ${
        Array.isArray(params.context.corrections)
          ? params.context.corrections.length
          : 1
      } corrections as few-shot for ${params.feature}`,
    );
  }

  const latencyMs = pickLatency(params.feature);
  await new Promise((r) => setTimeout(r, latencyMs));

  let data: unknown;
  if (params.feature === "brief") {
    data = briefFixture(params);
  } else if (params.feature === "consult") {
    data = consultFixture(params);
  } else {
    data = triageFixture(params);
  }

  return {
    data: data as T,
    raw: JSON.stringify(data),
    model: "glm-4.6-mock",
    latencyMs,
    source: "mock",
  };
}
