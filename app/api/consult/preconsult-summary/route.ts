/**
 * POST /api/consult/preconsult-summary
 *
 * Generates a short ~1-minute-read narrative for the doctor on the
 * consult page. Takes the patient's structured pre-consult brief
 * (lastVisit / chronic / compliance / pending / probe) and the
 * receptionist's chief complaint, and produces a single paragraph
 * the vet can scan in 30-60 seconds before walking into the room.
 *
 * Off the critical path of the multi-agent capture pipeline. Uses
 * Haiku 4.5 directly (no Tavily, no tool loop) — usually returns in
 * 2-4s. Has a deterministic fixture fallback when MOCK_MODE or no
 * Anthropic key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { ENV, hasLLM, isMockMode } from "@/lib/env";

const MAX_FIELD_LEN = 600;
const MODEL = ENV.anthropic.modelBrief; // Haiku 4.5

interface BodyShape {
  patientName: string;
  patientSpecies: string;
  patientBreed?: string;
  patientAge?: string;
  patientSex?: string;
  reason?: string;
  brief: {
    lastVisit?: string;
    chronic?: string;
    compliance?: string;
    pending?: string;
    probe?: string;
  };
}

function parse(raw: unknown): BodyShape {
  const r = raw as Partial<BodyShape>;
  if (!r || typeof r !== "object") throw new ApiError(400, "body must be object");
  if (typeof r.patientName !== "string" || !r.patientName.trim())
    throw new ApiError(400, "patientName required");
  if (typeof r.patientSpecies !== "string")
    throw new ApiError(400, "patientSpecies required");
  if (!r.brief || typeof r.brief !== "object")
    throw new ApiError(400, "brief required");
  const totalLen = JSON.stringify(r).length;
  if (totalLen > MAX_FIELD_LEN * 8)
    throw new ApiError(413, "payload too large");
  return r as BodyShape;
}

function fixtureSummary(b: BodyShape): string {
  const parts: string[] = [];
  parts.push(
    `${b.patientName} is a ${b.patientAge ?? ""} ${b.patientSex ?? ""} ${b.patientBreed ?? b.patientSpecies}.`,
  );
  if (b.reason) parts.push(`Today's chief complaint: ${b.reason}.`);
  if (b.brief.lastVisit && b.brief.lastVisit !== "No prior visits on record")
    parts.push(`Last visit: ${b.brief.lastVisit}.`);
  if (b.brief.chronic && b.brief.chronic !== "—")
    parts.push(`Chronic context: ${b.brief.chronic}.`);
  if (b.brief.compliance && b.brief.compliance !== "—")
    parts.push(`Compliance: ${b.brief.compliance}.`);
  if (b.brief.pending && b.brief.pending !== "—")
    parts.push(`Pending: ${b.brief.pending}.`);
  if (b.brief.probe && b.brief.probe !== "—")
    parts.push(`Probe today: ${b.brief.probe}.`);
  return parts.join(" ");
}

const SYSTEM_PROMPT = `You are a senior veterinarian briefing a colleague who is about to walk into the exam room. Given the patient's structured pre-consult brief, write a single concise paragraph (4-6 sentences, 80-150 words) that the doctor can read in 30-60 seconds.

Tone: professional, terse, clinical. No fluff, no headers, no bullet points — flowing prose. Lead with what matters most for THIS visit. End with the single most important thing to probe today.

Skip any fields that are empty / "—" / "No prior visits on record". Don't pad.`.trim();

function buildUserMessage(b: BodyShape): string {
  return [
    `Patient: ${b.patientName}, ${b.patientSpecies}${b.patientBreed ? ` (${b.patientBreed})` : ""}, ${b.patientAge ?? "?"}, ${b.patientSex ?? "?"}.`,
    b.reason ? `Chief complaint (from reception): ${b.reason}` : "",
    `Last visit: ${b.brief.lastVisit ?? "—"}`,
    `Chronic conditions: ${b.brief.chronic ?? "—"}`,
    `Compliance: ${b.brief.compliance ?? "—"}`,
    `Pending follow-ups: ${b.brief.pending ?? "—"}`,
    `Receptionist suggested to probe: ${b.brief.probe ?? "—"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

let client: Anthropic | null = null;
function anthro(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ENV.anthropic.apiKey });
  return client;
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const body = parse(raw);

    if (isMockMode() || !hasLLM()) {
      return json({ summary: fixtureSummary(body), source: "fixture" });
    }

    const t0 = Date.now();
    const res = await anthro().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(body) }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return json({
      summary: text || fixtureSummary(body),
      source: "anthropic",
      latencyMs: Date.now() - t0,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
