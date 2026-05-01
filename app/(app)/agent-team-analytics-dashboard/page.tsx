/**
 * Agent team analytics dashboard — judges' showcase view.
 *
 * Shows the multi-agent consultation capture pipeline running live:
 *   1. Architecture diagram with the 5 Haiku sub-agents fanning out
 *      to the Sonnet orchestrator. Each node lights up as it runs.
 *   2. Live timeline (Gantt-style) of parallel execution.
 *   3. Tavily query feed — every search fires here in real time.
 *   4. Token + cost panel with cache-hit accounting per agent.
 *   5. Doctor SOAP summary + owner Telegram preview.
 *
 * Talks to POST /api/consult/capture/stream over SSE. The pipeline
 * itself is identical to /api/consult/capture — just emits events as
 * it runs so this view can animate the fan-out.
 */

import AgentDashboardClient from "./_components/dashboard-client";

export const metadata = {
  title: "Agent Team Analytics — Consilium",
};

export default function Page() {
  return <AgentDashboardClient />;
}
