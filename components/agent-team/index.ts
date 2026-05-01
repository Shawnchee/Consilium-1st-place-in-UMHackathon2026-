/**
 * Barrel export for the multi-agent pipeline visualization.
 *
 * Consumers:
 *   - app/(app)/agent-team-analytics-dashboard — judge-facing showcase
 *   - app/(app)/consult — live doctor session view (Show Pipeline toggle)
 *
 * Keeps both pages in lockstep on event shapes, animations, and styling.
 */

export { ArchitectureDiagram } from "./architecture-diagram";
export { Timeline } from "./timeline";
export { TavilyFeed } from "./tavily-feed";
export { SendPanel } from "./send-panel";
export { useCaptureStream } from "./use-capture-stream";
export type { CaptureStreamInput } from "./use-capture-stream";
export type {
  AgentLane,
  AgentLanes,
  OrchestratorRange,
  PipelineEvent,
  SubAgentName,
  SubAgentSpec,
} from "./types";
export { SUB_AGENTS, initialLanes } from "./types";
