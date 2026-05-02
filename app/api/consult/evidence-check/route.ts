/**
 * POST /api/consult/evidence-check
 *
 * Off-critical-path Tavily-backed evidence check. Called by the consult
 * page AFTER the main multi-agent pipeline completes — the doctor sees
 * the SOAP / Rx / Billing immediately, then this banner resolves 8-15s
 * later (or instantly if the cache hits) with either a green ✓ or an
 * amber ⚠ flag.
 *
 * Body: { patientName, patientSpecies, diagnosis, drugs: string[] }
 * Returns: { status, summary, citations[], cached, latencyMs }
 */

import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { runEvidenceAgent, type EvidenceCheckInput } from "@/lib/agents/evidence-agent";

const MAX_DRUGS = 12;
const MAX_FIELD_LEN = 200;

function parse(raw: unknown): EvidenceCheckInput {
  const r = raw as Partial<EvidenceCheckInput>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.patientName !== "string" || !r.patientName.trim())
    throw new ApiError(400, "patientName required");
  if (typeof r.patientSpecies !== "string")
    throw new ApiError(400, "patientSpecies required");
  if (typeof r.diagnosis !== "string")
    throw new ApiError(400, "diagnosis required");
  if (!Array.isArray(r.drugs) || r.drugs.some((d) => typeof d !== "string"))
    throw new ApiError(400, "drugs must be string[]");
  if (r.drugs.length > MAX_DRUGS)
    throw new ApiError(413, `drugs exceeds ${MAX_DRUGS} entries`);
  if (
    r.patientName.length > MAX_FIELD_LEN ||
    r.patientSpecies.length > MAX_FIELD_LEN ||
    r.diagnosis.length > MAX_FIELD_LEN * 4
  )
    throw new ApiError(413, "field too long");
  return {
    patientName: r.patientName,
    patientSpecies: r.patientSpecies,
    diagnosis: r.diagnosis,
    drugs: r.drugs as string[],
  };
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const input = parse(raw);
    const t0 = Date.now();
    const { data, meta } = await runEvidenceAgent(input);
    return json({
      ...data,
      cached: meta.source === "mock",
      latencyMs: Date.now() - t0,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
