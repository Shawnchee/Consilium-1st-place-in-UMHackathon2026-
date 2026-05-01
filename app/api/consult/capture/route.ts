/**
 * POST /api/consult/capture
 *
 * Multi-agent consultation capture:
 *   1. Resolve patient (Supabase first, mock PATIENTS fallback).
 *   2. captureSession() — Haiku sub-agents fan out in parallel
 *      (voice / text / prescription / billing / todos), then Sonnet
 *      orchestrator emits the dual-audience summary.
 *   3. Best-effort persist into the visits table.
 *   4. If the patient has a Telegram chat ID and sendTelegram !== false,
 *      send the orchestrator's owner message to the owner.
 *
 * Returns the full SessionCaptureResult so the doctor's UI can render the
 * summary card immediately.
 */

import { PATIENTS } from "@/lib/data";
import {
  ApiError,
  parseConsultCaptureRequest,
} from "@/lib/api-types";
import { errorResponse, json } from "@/lib/api-response";
import { ENV, hasSupabase, hasSupabaseAdmin, hasTelegram } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { captureSession } from "@/lib/agents/orchestrator";
import type {
  SessionCaptureResult,
  SessionInput,
} from "@/lib/agents/sub-agents/types";

interface PatientLookup {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  ownerTelegram?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new ApiError(400, "invalid JSON");
    });
    const {
      patientId,
      notes,
      transcript,
      imageUrls,
      diagnosisHint,
      sendTelegram,
    } = parseConsultCaptureRequest(body);

    const patient = await resolvePatient(patientId);
    if (!patient) throw new ApiError(404, `patient ${patientId} not found`);

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

    const totalStart = Date.now();
    const captured = await captureSession(sessionInput);
    const totalLatencyMs = Date.now() - totalStart;

    let visitId = `mock-visit-${Date.now()}`;
    if (hasSupabaseAdmin()) {
      try {
        const db = getSupabaseServer();
        const soapText = [
          `S: ${captured.summary.doctorSummary.soap.S}`,
          `O: ${captured.summary.doctorSummary.soap.O}`,
          `A: ${captured.summary.doctorSummary.soap.A}`,
          `P: ${captured.summary.doctorSummary.soap.P}`,
        ].join("\n");
        const { data: inserted, error } = await db
          .from("visits")
          .insert({
            patient_id: patient.id,
            raw_notes: notes,
            soap_note: soapText,
            prescription: captured.summary.prescription,
            billing_items: captured.summary.billing,
            todo_list: captured.summary.todos,
          })
          .select("id")
          .maybeSingle<{ id: string }>();
        if (error) throw error;
        if (inserted?.id) visitId = inserted.id;
      } catch (dbErr) {
        console.warn(
          "[api/consult/capture] visit insert failed, continuing",
          dbErr,
        );
      }
    }

    const telegram = await maybeSendTelegram({
      patient,
      ownerBody: captured.summary.ownerMessage.body,
      aftercare: captured.summary.ownerMessage.aftercare,
      enabled: sendTelegram !== false,
    });

    const result: SessionCaptureResult = {
      visitId,
      session: captured.session,
      summary: captured.summary,
      meta: {
        totalLatencyMs,
        parallelAgentsLatencyMs: captured.meta.parallelAgentsLatencyMs,
        orchestratorLatencyMs: captured.meta.orchestratorLatencyMs,
        source: captured.meta.source,
      },
      telegram,
    };
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

async function resolvePatient(patientId: string): Promise<PatientLookup | null> {
  if (hasSupabase()) {
    try {
      const db = getSupabaseServer();
      const { data, error } = await db
        .from("patients")
        .select("id,name,species,breed,owner_telegram")
        .eq("id", patientId)
        .maybeSingle<{
          id: string;
          name: string;
          species: string | null;
          breed: string | null;
          owner_telegram: string | null;
        }>();
      if (error) throw error;
      if (data) {
        return {
          id: data.id,
          name: data.name,
          species: data.species ?? undefined,
          breed: data.breed ?? undefined,
          ownerTelegram: data.owner_telegram ?? undefined,
        };
      }
    } catch (dbErr) {
      console.warn(
        "[api/consult/capture] DB lookup error, falling back to mock",
        dbErr,
      );
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

async function maybeSendTelegram(args: {
  patient: PatientLookup;
  ownerBody: string;
  aftercare: string[];
  enabled: boolean;
}): Promise<SessionCaptureResult["telegram"]> {
  if (!args.enabled) return { sent: false, error: "delivery disabled by request" };
  if (!hasTelegram()) return { sent: false, error: "telegram not configured" };
  if (!args.patient.ownerTelegram) {
    return { sent: false, error: "no telegram chat id on patient record" };
  }
  const message = formatTelegramMessage(args.ownerBody, args.aftercare);
  try {
    const r = await sendTelegramMessage(args.patient.ownerTelegram, message);
    return { sent: true, messageId: r.messageId };
  } catch (err) {
    console.warn("[api/consult/capture] telegram send failed", err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function formatTelegramMessage(body: string, aftercare: string[]): string {
  const clinicName = ENV.clinic.name || "the clinic";
  const safeBody = body.replace(/\{clinic\}/g, clinicName);
  if (aftercare.length === 0) return safeBody;
  const aftercareLines = aftercare.map((a) => `• ${a}`).join("\n");
  return `${safeBody}\n\nAftercare:\n${aftercareLines}`;
}
