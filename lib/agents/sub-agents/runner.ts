/**
 * Sub-agent runner — thin wrapper around Anthropic SDK for the parallel
 * Haiku fan-out. Each sub-agent supplies its own emit tool spec + system
 * prompt + fallback fixture; the runner handles the tool-use loop, optional
 * Tavily integration, and timing/source metadata.
 *
 * Mirrors the contract in lib/llm.ts but runs on Haiku 4.5 (cheap + fast)
 * and is single-purpose per call — no clarifying-question tools, no
 * multi-turn conversation. Returns either the emit tool input (typed
 * payload) or the fallback when the model refuses to emit.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENV, hasLLM, hasTavily, isMockMode } from "../../env";
import { tavilyTool, executeTavily, type TavilyArgs } from "../../tools/tavily";
import type { LLMImage } from "../../llm";
import type { SubAgentMeta } from "./types";

const SUB_AGENT_MODEL = ENV.anthropic.modelBrief; // Haiku 4.5
const MAX_TOOL_ITERATIONS = 4;
const MAX_TOKENS = 1500;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ENV.anthropic.apiKey });
  return client;
}

export interface EmitToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface RunSubAgentParams<T> {
  agentName: string;
  systemPrompt: string;
  userMessage: string;
  emitTool: EmitToolSpec;
  fallback: () => T;
  /** Whether to expose tavily_search to this sub-agent. */
  enableTavily?: boolean;
  /** Optional images for multimodal sub-agents (e.g. text-agent on photos). */
  images?: LLMImage[];
}

export interface RunSubAgentResult<T> {
  data: T;
  meta: SubAgentMeta;
}

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

export async function runSubAgent<T>(
  params: RunSubAgentParams<T>,
): Promise<RunSubAgentResult<T>> {
  const startedAt = Date.now();

  if (isMockMode() || !hasLLM()) {
    return {
      data: params.fallback(),
      meta: {
        agent: params.agentName,
        model: "fixture",
        latencyMs: Date.now() - startedAt,
        source: "mock",
      },
    };
  }

  const c = getClient();
  const tools: unknown[] = [];
  const tavilyAvailable = Boolean(params.enableTavily && hasTavily());
  if (tavilyAvailable) tools.push(tavilyTool);
  tools.push(params.emitTool);

  // When only the emit tool is available, force the model to call it so we
  // never get a free-text refusal back (matches lib/llm.ts behaviour).
  const forceEmit = tools.length === 1;

  type Message = { role: "user" | "assistant"; content: unknown };
  const messages: Message[] = [
    { role: "user", content: buildUserContent(params.userMessage, params.images) },
  ];

  let toolCallCount = 0;
  let tavilyUsed = false;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = (await c.messages.create({
      model: SUB_AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      system: params.systemPrompt,
      tools: tools as Anthropic.Tool[],
      tool_choice: forceEmit
        ? ({ type: "tool", name: params.emitTool.name } as Anthropic.ToolChoice)
        : undefined,
      messages: messages as Anthropic.MessageParam[],
    })) as Anthropic.Message;

    const blocks = response.content as AnthropicContentBlock[];
    const toolUses = blocks.filter(
      (b): b is AnthropicToolUseBlock => b.type === "tool_use",
    );

    const emit = toolUses.find((tu) => tu.name === params.emitTool.name);
    if (emit) {
      return {
        data: emit.input as T,
        meta: {
          agent: params.agentName,
          model: SUB_AGENT_MODEL,
          latencyMs: Date.now() - startedAt,
          source: "glm",
          toolCalls: toolCallCount,
          tavilyUsed,
        },
      };
    }

    // No tool calls → model refused. Fall back.
    if (toolUses.length === 0) {
      return {
        data: params.fallback(),
        meta: {
          agent: params.agentName,
          model: SUB_AGENT_MODEL,
          latencyMs: Date.now() - startedAt,
          source: "glm",
          toolCalls: toolCallCount,
          tavilyUsed,
        },
      };
    }

    // Server-execute any tavily calls; loop again.
    const toolResults: {
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }[] = [];
    for (const tu of toolUses) {
      if (tu.name === "tavily_search") {
        toolCallCount++;
        tavilyUsed = true;
        try {
          const result = await executeTavily(tu.input as unknown as TavilyArgs);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(result).slice(0, 6000),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Tavily error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Tool ${tu.name} not available in this sub-agent.`,
        });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  return {
    data: params.fallback(),
    meta: {
      agent: params.agentName,
      model: SUB_AGENT_MODEL,
      latencyMs: Date.now() - startedAt,
      source: "glm",
      toolCalls: toolCallCount,
      tavilyUsed,
    },
  };
}

function buildUserContent(
  text: string,
  images?: LLMImage[],
): string | AnthropicContentBlock[] {
  if (!images || images.length === 0) return text;
  const blocks: AnthropicContentBlock[] = [];
  for (const img of images) {
    if (img.url) {
      blocks.push({ type: "image", source: { type: "url", url: img.url } });
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
  blocks.push({ type: "text", text });
  return blocks;
}
