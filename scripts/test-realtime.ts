/**
 * Realtime smoke test.
 *
 *   npx tsx scripts/test-realtime.ts
 *
 * Subscribes to `followups` postgres_changes with the anon key, then writes
 * a real status change via the service role. Exits 0 on first event.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { ENV, hasSupabase, hasSupabaseAdmin } = await import("../lib/env");

  if (!hasSupabase()) throw new Error("Supabase not configured");
  if (!hasSupabaseAdmin()) throw new Error("Need service role key");

  const sb = createClient(ENV.supabase.url, ENV.supabase.anonKey, {
    auth: { persistSession: false },
  });
  const admin = createClient(ENV.supabase.url, ENV.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await admin
    .from("followups")
    .select("id, status")
    .limit(1);
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error("No followups in DB");
  const target = rows[0] as { id: string; status: string };
  const newStatus = target.status === "escalate" ? "monitor" : "escalate";
  console.log(
    `[smoke] target=${target.id}  ${target.status} -> ${newStatus}`,
  );

  let gotEvent = false;

  const channel = sb.channel("smoke-followups").on(
    "postgres_changes",
    { event: "*", schema: "public", table: "followups" },
    (payload) => {
      console.log(
        `[smoke] <-- ${payload.eventType} id=${(payload.new as { id?: string })?.id ?? "?"}`,
      );
      gotEvent = true;
    },
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("subscribe timeout")), 10_000);
    channel.subscribe((status, err) => {
      console.log(`[smoke] channel=${status}${err ? " err=" + err.message : ""}`);
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error(`channel failed: ${status}`));
      }
    });
  });

  // Extra settle so the server fully binds the postgres_changes filter.
  await new Promise((r) => setTimeout(r, 3000));

  console.log("[smoke] triggering UPDATE...");
  const { error: upErr } = await admin
    .from("followups")
    .update({ status: newStatus })
    .eq("id", target.id);
  if (upErr) throw upErr;

  const deadline = Date.now() + 10_000;
  while (!gotEvent && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }

  // Revert so the DB stays demo-ready.
  await admin
    .from("followups")
    .update({ status: target.status })
    .eq("id", target.id);

  await sb.removeChannel(channel);

  if (!gotEvent) {
    console.error("[smoke] FAIL — no event in 10 s");
    process.exit(1);
  }
  console.log("[smoke] OK");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
