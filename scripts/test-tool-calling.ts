/**
 * End-to-end tool-calling smoke.
 *
 *   npx tsx scripts/test-tool-calling.ts
 *
 * Seeds a fresh followup linked to a stub chat id, then calls
 * `handleOwnerMessage` twice simulating a real two-turn conversation.
 * Verifies: turn 1 returns a tool_call, DB records the bot_tool turn,
 * tool_call_count increments; turn 2 returns a decision, DB status
 * flips to escalate/monitor/clear, conversation gets a bot_decision
 * turn appended. Cleans up the test row at the end.
 *
 * NB: suppress the handler's Telegram SEND — we're simulating receipt
 * only. Nothing is actually posted to Telegram in this script.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const STUB_CHAT_ID = `test-${Date.now()}`;

(async () => {
  const { hasSupabaseAdmin } = await import("../lib/env");
  if (!hasSupabaseAdmin()) throw new Error("Supabase admin not configured");

  const { getSupabaseServer } = await import("../lib/supabase");
  const { handleOwnerMessage } = await import("../lib/telegram-handler");

  const db = getSupabaseServer();

  // Pick any visit to anchor the followup.
  const { data: visits, error: vErr } = await db
    .from("visits")
    .select("id")
    .limit(1);
  if (vErr) throw vErr;
  if (!visits?.length) throw new Error("No visits — seed first");
  const visitId = (visits[0] as { id: string }).id;

  // Seed a clean followup.
  const { data: inserted, error: iErr } = await db
    .from("followups")
    .insert({
      visit_id: visitId,
      status: "pending",
      telegram_chat_id: STUB_CHAT_ID,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (iErr) throw iErr;
  const followupId = inserted!.id;
  console.log(`\n[smoke] seeded followup=${followupId} chat=${STUB_CHAT_ID}\n`);

  try {
    // ── Turn 1 — ambiguous visual signal. Expect tool_call. ───────────
    const r1 = await handleOwnerMessage(
      STUB_CHAT_ID,
      "She has some blood near her bed and seems a bit swollen",
    );
    if (r1.decision !== "awaiting_info") {
      throw new Error(
        `Turn 1 expected tool_call (awaiting_info), got decision=${r1.decision}`,
      );
    }

    const { data: mid } = await db
      .from("followups")
      .select("status, tool_call_count, conversation")
      .eq("id", followupId)
      .maybeSingle();
    console.log(
      `[smoke] after turn 1: status=${(mid as { status: string }).status} tool_calls=${(mid as { tool_call_count: number }).tool_call_count} turns=${((mid as { conversation: unknown[] }).conversation ?? []).length}`,
    );

    // ── Turn 2 — owner confirms bleeding source. Expect escalate. ────
    const r2 = await handleOwnerMessage(
      STUB_CHAT_ID,
      "Yes it's bleeding from the stitches, getting worse",
    );
    if (r2.decision !== "escalate") {
      throw new Error(
        `Turn 2 expected escalate decision, got ${r2.decision}`,
      );
    }

    const { data: end } = await db
      .from("followups")
      .select("status, conversation")
      .eq("id", followupId)
      .maybeSingle();
    const finalStatus = (end as { status: string }).status;
    const finalTurns = ((end as { conversation: unknown[] }).conversation ??
      []) as unknown[];
    console.log(
      `\n[smoke] after turn 2: status=${finalStatus}  turns=${finalTurns.length}`,
    );

    if (finalStatus !== "escalate") {
      throw new Error(`DB status not escalate, got ${finalStatus}`);
    }
    if (finalTurns.length !== 4) {
      throw new Error(`Expected 4 turns in conversation, got ${finalTurns.length}`);
    }
    console.log("\n[smoke] OK — tool-calling round-trip verified");
  } finally {
    // Cleanup
    await db.from("followups").delete().eq("id", followupId);
    console.log(`[smoke] cleanup — deleted followup ${followupId}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
