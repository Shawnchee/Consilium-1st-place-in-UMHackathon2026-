/**
 * In-memory passport store used as a fallback when Supabase isn't
 * configured. Survives only the lifetime of the dev server process —
 * good enough for local demo on a single machine. Production must use
 * the Supabase-backed path.
 */

import type { PassportPayload } from "./types";

const memory = new Map<string, PassportPayload>();

export const passportMemory = {
  get(patientId: string): PassportPayload | null {
    return memory.get(patientId) ?? null;
  },
  set(patientId: string, payload: PassportPayload) {
    memory.set(patientId, payload);
  },
};
