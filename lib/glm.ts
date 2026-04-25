/**
 * Back-compat shim. The implementation moved to lib/llm.ts (Anthropic Claude).
 * Existing imports of `@/lib/glm` continue to work unchanged.
 */

export {
  callGLM,
  type CallGLMParams,
  type CallGLMResult,
  type GLMFeature,
  type LLMImage,
} from "./llm";
