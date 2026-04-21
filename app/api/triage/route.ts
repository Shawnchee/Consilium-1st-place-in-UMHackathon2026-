import { ApiError, parseTriageRequest } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { callGLM } from "@/lib/glm";
import type { TriageFixtureOutput } from "@/lib/glm-fixtures";
import type { TriageResponse } from "@/lib/api-types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const { message } = parseTriageRequest(body);

    const result = await callGLM<TriageFixtureOutput>({
      feature: "triage",
      user: message,
    });

    return json<TriageResponse>({ ...result.data, source: result.source });
  } catch (err) {
    return errorResponse(err);
  }
}
