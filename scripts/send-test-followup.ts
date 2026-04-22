/**
 * Rehearsal helper — seeds a followup row linked to your Telegram chat id
 * and sends the 24h opening message. After this runs, any reply from that
 * chat flows through the live triage pipeline.
 *
 *   npx tsx scripts/send-test-followup.ts <CHAT_ID> [PATIENT_NAME]
 *
 * Get your chat id by messaging the bot once (it replies with it on /start).
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

(async () => {
  const chatId = process.argv[2];
  const patientNameArg = process.argv[3];

  if (!chatId) {
    console.error(
      "Usage: npx tsx scripts/send-test-followup.ts <CHAT_ID> [PATIENT_NAME]",
    );
    process.exit(1);
  }

  const { hasSupabaseAdmin, hasTelegram } = await import("../lib/env");
  if (!hasTelegram()) throw new Error("TELEGRAM_BOT_TOKEN missing");
  if (!hasSupabaseAdmin()) throw new Error("Supabase admin not configured");

  const { getSupabaseServer } = await import("../lib/supabase");
  const { sendTelegramMessage } = await import("../lib/telegram");

  const db = getSupabaseServer();

  // Pick a visit — by patient name if provided, otherwise latest.
  let visitQuery = db
    .from("visits")
    .select("id, patients!inner(name, owner_name)")
    .order("visit_date", { ascending: false })
    .limit(1);
  if (patientNameArg) {
    visitQuery = visitQuery.eq("patients.name", patientNameArg);
  }
  const { data: visits, error: visitErr } = await visitQuery;
  if (visitErr) throw visitErr;
  if (!visits || visits.length === 0) {
    throw new Error(
      patientNameArg
        ? `No visit found for patient "${patientNameArg}" — seed it first.`
        : "No visits in DB — run supabase/seed.sql first.",
    );
  }

  const visit = visits[0] as unknown as {
    id: string;
    patients: { name: string; owner_name: string | null };
  };
  const patient = visit.patients;

  const { data: followup, error: fuErr } = await db
    .from("followups")
    .insert({
      visit_id: visit.id,
      status: "pending",
      telegram_chat_id: chatId,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (fuErr) throw fuErr;

  const opener = `Hi ${patient.owner_name ?? "there"}, this is PawsClinic KL checking in 24h after ${patient.name}'s visit. How are they doing? Any concerns with appetite, energy, or the treatment site? Reply any time.`;

  await sendTelegramMessage(chatId, opener);
  console.log(
    `Seeded followup ${followup?.id} → ${patient.name} (${patient.owner_name ?? "—"}) → chat ${chatId}`,
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
