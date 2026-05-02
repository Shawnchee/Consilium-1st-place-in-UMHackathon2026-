import { ApiError, parseTriageRequest } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { callGLM } from "@/lib/glm";
import type { TriageFixtureOutput } from "@/lib/glm-fixtures";
import type { TriageResponse } from "@/lib/api-types";

// The bot/webhook path (lib/telegram-handler.ts) runs the multi-turn
// tool-calling flow. This HTTP route is kept for ad-hoc callers that just
// want a one-shot decision — so we pass toolCallCount=1 to force the
// fixture past any info-gathering turn.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const { message } = parseTriageRequest(body);

    const isManualEscalation = message.includes("[MANUAL DOCTOR ESCALATION]");

    const result = await callGLM<TriageFixtureOutput>({
      feature: "triage",
      user: message,
      system: isManualEscalation 
        ? "You are a veterinary assistant. THE DOCTOR HAS MANUALLY ESCALATED THIS CASE. You MUST provide a terminal 'emit_decision' with decision='escalate'. Do NOT use any clarifying tools. Write a warm, professional escalation reply for the owner."
        : undefined,
      context: { toolCallCount: 1 },
    });

    if (result.data.kind !== "decision") {
      // Shouldn't happen with toolCallCount=1, but degrade gracefully.
      throw new ApiError(500, "triage produced non-terminal result");
    }

    const d = result.data;
    return json<TriageResponse>({
      decision: d.decision,
      confidence: d.confidence,
      differentials: d.differentials,
      recommendedAction: d.recommendedAction,
      ownerReplyDraft: d.ownerReplyDraft,
      doctorSummary: d.doctorSummary,
      source: result.source,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
