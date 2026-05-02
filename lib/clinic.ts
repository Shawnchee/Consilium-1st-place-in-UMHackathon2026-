/**
 * Client-safe clinic identity.
 *
 * Server-side code should prefer `ENV.clinic` from `lib/env.ts`. This module
 * exists because Next.js only inlines `process.env.NEXT_PUBLIC_*` references
 * at build time when they're accessed via *static* property syntax — `lib/env.ts`
 * uses dynamic `process.env[name]` reads, which the browser bundle can't see.
 *
 * Defaults match the server-side ones so a dev who hasn't set the env vars
 * still gets a coherent demo identity.
 */

export const CLINIC = {
  id: process.env.NEXT_PUBLIC_CLINIC_ID || "pawsclinic_kl",
  name: process.env.NEXT_PUBLIC_CLINIC_NAME || "Peng Aun Clinic Penang",
  doctor: process.env.NEXT_PUBLIC_CLINIC_DOCTOR || "Dr. Amirah",
  phone: process.env.NEXT_PUBLIC_CLINIC_PHONE || "+60 13 928 4717",
} as const;
