/**
 * POST /api/consult/capture/stream
 *
 * Same pipeline as /api/consult/capture, but streams lifecycle events
 * over Server-Sent Events so the analytics dashboard can visualize the
 * parallel fan-out happening in real time.
 *
 * Wire format: standard SSE — each event is `data: <json>\n\n`. The
 * client should subscribe and parse JSON per event. The terminal
 * `session_completed` event carries the full SessionCaptureResult
 * shape for the doctor-summary panel.
 */

import { PATIENTS } from "@/lib/data";
import {
  ApiError,
  parseConsultCaptureRequest,
} from "@/lib/api-types";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { captureSession, type CaptureEvent } from "@/lib/agents/orchestrator";
import type { SessionInput } from "@/lib/agents/sub-agents/types";

interface PatientLookup {
  id: string;
  name: string;
  species?: string;
  breed?: string;
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let parsed;
  try {
    parsed = parseConsultCaptureRequest(body);
  } catch (err) {
    if (err instanceof ApiError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "content-type": "application/json" },
      });
    }
    throw err;
  }
  const { patientId, notes, transcript, imageUrls, diagnosisHint } = parsed;

  const patient = await resolvePatient(patientId);
  if (!patient) {
    return new Response(
      JSON.stringify({ error: `patient ${patientId} not found` }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }

  const sessionInput: SessionInput = {
    patientId: patient.id,
    patientName: patient.name,
    patientSpecies: patient.species,
    patientBreed: patient.breed,
    notes,
    transcript,
    imageUrls,
    diagnosisHint,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: CaptureEvent | { type: "error"; message: string }) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Connection closed by client — swallow.
        }
      };

      try {
        await captureSession(sessionInput, { onEvent: send });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

async function resolvePatient(patientId: string): Promise<PatientLookup | null> {
  if (hasSupabase() || hasSupabaseAdmin()) {
    try {
      const db = getSupabaseServer();
      const { data, error } = await db
        .from("patients")
        .select("id,name,species,breed")
        .eq("id", patientId)
        .maybeSingle<{
          id: string;
          name: string;
          species: string | null;
          breed: string | null;
        }>();
      if (error) throw error;
      if (data) {
        return {
          id: data.id,
          name: data.name,
          species: data.species ?? undefined,
          breed: data.breed ?? undefined,
        };
      }
    } catch {
      // fall through to mock
    }
  }
  const mock = PATIENTS.find((x) => x.id === patientId);
  if (!mock) return null;
  return {
    id: mock.id,
    name: mock.name,
    species: mock.species,
    breed: mock.breed,
  };
}
