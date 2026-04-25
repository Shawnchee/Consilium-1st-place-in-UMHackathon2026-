/**
 * Claude wrapper — replaces the legacy Z.AI/GLM client.
 *
 * Public surface (`callGLM`, `CallGLMParams`, `CallGLMResult`) is preserved
 * so existing routes and the Telegram handler need no changes. The body
 * routes to Claude via @anthropic-ai/sdk in real mode and to lib/glm-fixtures
 * in mock mode.
 *
 * Tool-use loop: each feature exposes an `emit_<feature>` tool that carries
 * the structured output as its input. The model may also call:
 *   - tavily_search (server-executed, results fed back)
 *   - request_<X>   (user-facing, breaks the loop and returns a tool_call
 *                    payload shaped like the legacy fixture's TriageToolCall)
 * See lib/tools/registry.ts for the full registry.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENV, hasLLM, isMockMode } from "./env";
import {
  BRIEF_PROMPT,
  CONSULT_EXTRACTION_PROMPT,
  TRIAGE_PROMPT,
} from "./prompts";
import { lookupTool, registryFor, type Feature } from "./tools/registry";
import { briefFixture, consultFixture, triageFixture } from "./glm-fixtures";

export type GLMFeature = Feature;

export interface LLMImage {
  /** Public URL the model can fetch. */
  url?: string;
  /** Or raw base64 (no data: prefix). Provide mediaType too. */
  base64?: string;
  /** MIME type when using base64. Defaults to image/jpeg. */
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export interface CallGLMParams {
  feature: GLMFeature;
  system?: string;
  user: string;
  /** Legacy flag — kept for back-compat, no-op now (schema enforced via emit_* tool). */
  json?: boolean;
  context?: Record<string, unknown>;
  /** Legacy passthrough — ignored; tool registry is now per-feature. */
  tools?: unknown[];
  /** Optional images for multimodal calls (consult dictation w/ photos, triage w/ owner pic). */
  images?: LLMImage[];
}

export interface CallGLMResult<T = unknown> {
  data: T;
  raw: string;
  model: string;
  latencyMs: number;
  source: "mock" | "glm";
  toolCalls?: unknown[];
}

const PROMPTS: Record<GLMFeature, string> = {
  brief: BRIEF_PROMPT,
  consult: CONSULT_EXTRACTION_PROMPT,
  triage: TRIAGE_PROMPT,
};

const MODEL_BY_FEATURE: Record<GLMFeature, string> = {
  brief: ENV.anthropic.modelBrief,
  consult: ENV.anthropic.modelConsult,
  triage: ENV.anthropic.modelTriage,
};

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 2048;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ENV.anthropic.apiKey });
  return client;
}

/* ─── public entry ────────────────────────────────────────────────────── */

export async function callGLM<T = unknown>(
  params: CallGLMParams,
): Promise<CallGLMResult<T>> {
  if (isMockMode() || !hasLLM()) {
    return mockPath<T>(params);
  }
  return realPath<T>(params);
}

/* ─── mock path (fixtures) ────────────────────────────────────────────── */

function mockPath<T>(params: CallGLMParams): CallGLMResult<T> {
  const startedAt = Date.now();
  let data: unknown;
  switch (params.feature) {
    case "brief":
      data = briefFixture(params);
      break;
    case "consult":
      data = consultFixture(params);
      break;
    case "triage":
      data = triageFixture(params);
      break;
  }
  return {
    data: data as T,
    raw: JSON.stringify(data),
    model: "fixture",
    latencyMs: Date.now() - startedAt,
    source: "mock",
  };
}

/* ─── real path (Claude) ──────────────────────────────────────────────── */

interface AnthropicTextBlock {
  type: "text";
  text: string;
}
interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | { type: string; [k: string]: unknown };

async function realPath<T>(params: CallGLMParams): Promise<CallGLMResult<T>> {
  const startedAt = Date.now();
  const c = getClient();
  const model = MODEL_BY_FEATURE[params.feature];
  const tools = registryFor(params.feature);
  const toolSpecs = tools.map((t) => t.spec);

  // For features whose only tool is the emit_* output (currently brief),
  // force the model to call it. Otherwise Sonnet/Haiku will sometimes
  // return free-text "I need more info..." instead of best-effort emitting.
  const emitOnly =
    tools.length === 1 && tools[0].handling === "emit" ? tools[0].spec.name : null;

  const system = buildSystem(params);
  const userContent = buildUserContent(params);

  type Message = {
    role: "user" | "assistant";
    content: string | AnthropicContentBlock[] | unknown;
  };
  const messages: Message[] = [{ role: "user", content: userContent }];

  const allToolCalls: AnthropicToolUseBlock[] = [];
  let lastResponse: Anthropic.Message | undefined;
  let iter = 0;

  while (iter < MAX_TOOL_ITERATIONS) {
    iter += 1;
    const response = (await c.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system,
      tools: toolSpecs as Anthropic.Tool[],
      tool_choice: emitOnly
        ? ({ type: "tool", name: emitOnly } as Anthropic.ToolChoice)
        : undefined,
      messages: messages as Anthropic.MessageParam[],
    })) as Anthropic.Message;
    lastResponse = response;

    const blocks = response.content as AnthropicContentBlock[];
    const toolUses = blocks.filter(
      (b): b is AnthropicToolUseBlock => b.type === "tool_use",
    );
    toolUses.forEach((tu) => allToolCalls.push(tu));

    // No tool use? Model just returned text. Try to parse as JSON for the
    // structured contracts; otherwise return raw.
    if (toolUses.length === 0) {
      const text = blocks
        .filter((b): b is AnthropicTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const data = safeParse<T>(text);
      return {
        data,
        raw: text,
        model,
        latencyMs: Date.now() - startedAt,
        source: "glm",
        toolCalls: allToolCalls,
      };
    }

    // Look for an emit_* call — that's our terminal structured output.
    const emit = toolUses.find((tu) => {
      const reg = lookupTool(params.feature, tu.name);
      return reg?.handling === "emit";
    });
    if (emit) {
      return {
        data: emit.input as T,
        raw: JSON.stringify(emit.input),
        model,
        latencyMs: Date.now() - startedAt,
        source: "glm",
        toolCalls: allToolCalls,
      };
    }

    // Look for a user-facing tool — break the loop, hand back to caller.
    const userFacing = toolUses.find((tu) => {
      const reg = lookupTool(params.feature, tu.name);
      return reg?.handling === "user";
    });
    if (userFacing) {
      const input = userFacing.input as {
        args?: Record<string, unknown>;
        reasoning?: string;
        ownerPrompt?: string;
      };
      const data = {
        kind: "tool_call",
        tool: userFacing.name,
        args: input.args ?? {},
        reasoning: input.reasoning ?? "Model requested clarification.",
        ownerPrompt:
          input.ownerPrompt ?? "Could you tell me a little more?",
      } as unknown as T;
      return {
        data,
        raw: JSON.stringify(input),
        model,
        latencyMs: Date.now() - startedAt,
        source: "glm",
        toolCalls: allToolCalls,
      };
    }

    // All remaining tool_uses must be server-executed. Run them, feed back.
    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const tu of toolUses) {
      const reg = lookupTool(params.feature, tu.name);
      if (!reg || reg.handling !== "server" || !reg.executor) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Tool ${tu.name} is not server-executable.`,
        });
        continue;
      }
      try {
        const result = await reg.executor(tu.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  // Loop exhausted — return whatever the last response gave us.
  const text =
    (lastResponse?.content as AnthropicContentBlock[] | undefined)
      ?.filter((b): b is AnthropicTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n") ?? "";
  return {
    data: safeParse<T>(text),
    raw: text,
    model,
    latencyMs: Date.now() - startedAt,
    source: "glm",
    toolCalls: allToolCalls,
  };
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

function buildSystem(params: CallGLMParams): string {
  let system = params.system ?? PROMPTS[params.feature];
  const ctx = params.context ?? {};
  if (Array.isArray(ctx.corrections) && ctx.corrections.length > 0) {
    const correctionsText = (ctx.corrections as Array<Record<string, unknown>>)
      .map((c) => `User: ${c.user}\nCorrection: ${c.correction}`)
      .join("\n\n");
    system += `\n\nExisting doctor corrections (follow these patterns):\n${correctionsText}`;
  }
  if (typeof ctx.toolCallCount === "number") {
    system += `\n\nContext: toolCallCount=${ctx.toolCallCount}.`;
  }
  if (typeof ctx.patientName === "string") {
    system += `\nPatient: ${ctx.patientName}.`;
  }
  if (typeof ctx.conversationText === "string" && ctx.conversationText.length > 0) {
    system += `\nConversation so far: ${ctx.conversationText}`;
  }
  return system;
}

function buildUserContent(
  params: CallGLMParams,
): string | AnthropicContentBlock[] {
  if (!params.images || params.images.length === 0) return params.user;
  const blocks: AnthropicContentBlock[] = [];
  for (const img of params.images) {
    if (img.url) {
      blocks.push({
        type: "image",
        source: { type: "url", url: img.url },
      });
    } else if (img.base64) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType ?? "image/jpeg",
          data: img.base64,
        },
      });
    }
  }
  blocks.push({ type: "text", text: params.user });
  return blocks;
}

function safeParse<T>(text: string): T {
  const sanitized = text.replace(/```json|```/g, "").trim();
  if (!sanitized) return {} as T;
  try {
    return JSON.parse(sanitized) as T;
  } catch {
    return text as unknown as T;
  }
}
