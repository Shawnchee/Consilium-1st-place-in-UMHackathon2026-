/**
 * Supabase clients. Lazily initialised so the app still boots in MOCK_MODE
 * with no Supabase env vars set.
 *
 *   - `getSupabaseBrowser()` — anon key, safe for the browser. Use inside
 *     `"use client"` components or `lib/api.ts` wrappers that run client-side.
 *   - `getSupabaseServer()` — service role key, bypasses RLS. Server-only.
 *     Never import this from a client component.
 *
 * Both throw if called without the required env vars. Routes should gate
 * calls with `hasSupabase()` / `hasSupabaseAdmin()` and fall back to mock.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, hasSupabase, hasSupabaseAdmin } from "./env";

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!hasSupabase()) {
    throw new Error(
      "Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  if (!browserClient) {
    browserClient = createClient(ENV.supabase.url, ENV.supabase.anonKey, {
      auth: { persistSession: false },
    });
  }
  return browserClient;
}

export function getSupabaseServer(): SupabaseClient {
  if (!hasSupabaseAdmin()) {
    throw new Error(
      "Supabase admin not configured: set SUPABASE_SERVICE_ROLE_KEY (server-only).",
    );
  }
  if (!serverClient) {
    serverClient = createClient(ENV.supabase.url, ENV.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}
