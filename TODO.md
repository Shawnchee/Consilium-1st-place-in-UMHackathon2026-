# Consilium — Build TODO (phased)

Current state: Next.js 16 + React 19 + Tailwind v4 frontend is scaffolded. Routes exist for dashboard, consult, follow-ups, analytics, passport. Mock data lives in `lib/data.ts`. Store is a React context (`components/app-shell/store.tsx`). API routes live in `app/api/*` and return Supabase-backed data when live, mock fallback otherwise.

Blocked on credentials: **Z.AI GLM API key** may not land before prelim submission. Plan is **mock-GLM-first**: canned GLM output with real latency + streamed reveal. Telegram + Supabase run live — demo uses a real Telegram bot talking to the mock GLM, which is visually indistinguishable from the full product. Real-integration work for GLM is tracked in the Backlog section below.

Checkpoint rule: finish a phase, run `npm run build` + smoke test, confirm with user before starting the next phase.

**Swappability contract**: `lib/glm.ts` ships as a mock module with the exact function signature the real Z.AI client will have. Swapping = replace the module body, not rewire callers. Route handlers never branch on `isMockMode()` — they call the module, the module decides. `lib/telegram.ts` is real from M8 onwards — no mock layer needed since we have the bot token.

---

## Phase 0 — Infra prep (no keys needed) ✅ DONE — commit 3505cd0
- [x] `.env.local.example` with every var, `.env.local` gitignored.
- [~] Runtime deps installed per-phase (zod deferred — hand-rolled validators).
- [x] `lib/env.ts` typed env reader + `isMockMode()` helper.
- [x] `npm run build` passes.

## Phase 1 — Domain model + API contracts (no keys) ✅ DONE — commit 1a3b
- [x] `lib/api-types.ts` shared request/response types, hand-rolled validators.
- [x] Routes scaffolded with mock data: `brief`, `consult`, `triage`, `patients`, `corrections`, `followups`.
- [x] Curl-tested: happy paths + 400/404 + all three triage branches.

## Phase 2 — Frontend ↔ API wiring (no keys) ✅ DONE
- [x] `lib/api.ts` typed client. Store fetches on mount; exposes loading/error/refresh.
- [x] `/api/metrics` + `/api/analytics` added. All six pages wired.
- [x] Escalation approve → `api.correction()` fire-and-forget.
- [ ] Dashboard patient-card `/api/brief` fetch still deferred. *(Revisit in Phase 6-real backlog.)*

## Phase 3 — Supabase schema files ✅ DONE
- [x] `supabase/migrations/0001_init.sql`, `supabase/seed.sql` (9 patients / 9 visits / 5 followups).
- [x] `lib/supabase.ts` browser + server clients, env-gated.
- [x] `supabase/README.md` documented.

## Phase 4 — Supabase live ✅ DONE
- [x] Env vars pasted, migration + seed applied via Supabase MCP.
- [x] `/api/patients`, `/api/followups`, `/api/brief` read from Supabase when `hasSupabase()`, mock fallback on error.
- [x] `lib/supabase-mappers.ts` overlays display-only fields from `lib/data.ts` by name.

---

## 🎬 Mock-first demo track (no GLM/Telegram keys needed) ← WE ARE HERE

Goal: every user-visible surface behaves as if GLM + Telegram were live. Real wiring deferred to Backlog. Each phase must leave `npm run build` green.

## Phase M5 — Mock GLM client + prompt scaffolding ✅ DONE
- [x] `lib/glm.ts` — `callGLM<T>({feature, system?, user, json?, context?}): Promise<CallGLMResult<T>>`. Real-client signature. 600–1400 ms jittered delay. Imports `lib/prompts.ts` so Phase 5-real is a body-only swap. Logs "would inject" when `context.corrections` is present (Phase 10-real stub).
- [x] `lib/glm-fixtures.ts` — `briefFixture`, `consultFixture`, `triageFixture`. Triage keyword-matches on red-flag / monitor / clear, reproducing the inline classifier previously in `/api/triage`.
- [x] `lib/prompts.ts` — `BRIEF_PROMPT`, `CONSULT_EXTRACTION_PROMPT`, `TRIAGE_PROMPT`. Hackathon-grade (no PRD §11 anchor yet).
- [x] `lib/billing-matrix.ts` — 5-diagnosis starter matrix + `billablesFor(diagnosis)` helper.
- [x] `scripts/test-glm.ts` — smoke script. All 3 triage branches fire; consult flags 2 billing items; few-shot hook logs. `npm run build` green.
- [~] Installed `tsx` as devDep to run the smoke script (small, isolated — acceptable lockfile churn).

## Phase M6 — Route AI features through mock GLM ✅ DONE
- [x] `/api/brief` → `callGLM({feature: "brief", ...})`. Supabase resolves the patient row; `briefFixture` looks up the hand-authored brief from `lib/data.ts` by name so dashboard output stays identical.
- [x] `/api/consult` → `callGLM({feature: "consult", ...})` + persists a `visits` row (patient_id, raw_notes, soap_note as formatted text, prescription/billing/todos as JSONB). `visitId` returned to client is a real Supabase UUID when DB write succeeds, mock fallback otherwise.
- [x] `/api/triage` → `callGLM({feature: "triage", ...})`. Inline keyword classifier deleted — fixture reproduces all 3 branches.
- [x] Per-feature latency envelopes in `lib/glm.ts` (brief 500–900, consult 1200–2200, triage 600–1000). Consult "thinking" now lands at ~1.5s which reads as substantial in the UI.
- [x] Curl-verified end-to-end on live Supabase: brief returns named brief (911 ms), consult persists real visit UUID + 2 flagged billing rows (2.1 s), triage all 3 branches (~1 s each).

## Phase M7 — UX polish (loaders, reveal, toasts) ✅ DONE
- [x] New primitives: `components/app-shell/skeleton.tsx` (`Skeleton` + `SkeletonKpiCard`, `SkeletonPatientRow`, `SkeletonEscalationCard`, `SkeletonBrief`), `components/app-shell/streamed-text.tsx`, `components/app-shell/error-banner.tsx`. Added `skeletonPulse` + `caretBlink` keyframes in `globals.css`.
- [x] Dashboard: 4× KPI + 5× patient-row skeletons when `loading && patients.length === 0`. ErrorBanner with retry above KPIs when store error set.
- [x] Analytics: local loading/error state added around `api.getAnalytics()`. 4× KPI card skeletons while loading. ErrorBanner with retry.
- [x] Follow-ups: 3× escalation-card skeletons at the top while loading; section headings hidden. ErrorBanner with retry.
- [x] Brief expansion: `briefReady` flag in `PatientRow` flips to true 200 ms after expand; `SkeletonBrief` rendered in between so it feels fetched.
- [x] Consult output: SOAP lines wrapped in `<StreamedText>` (2-word chunks, 35 ms, staggered 220 + i·180 ms). Existing `GeneratingMarquee` + `DotPulse` + `StatusPill` kept as the pre-output thinking state.
- [x] Toast on consult generate success: "Extracted · N billing items · RM X recoverable" (or fallback summary when nothing flagged). Approve toasts on SOAP/Rx/Billing/Todos already in place. Escalation approve toast already in place.
- [~] Triage-decision toast deferred to Phase M8 — no UI today receives triage output (the simulated chat there will fire one on each bot turn).
- [x] `npm run build` green; all 5 pages HTTP 200. Visual feel (pulse cadence, caret blink, stream rate) needs in-browser review.

## Phase M8 — Real Telegram bot (polling) ← `TELEGRAM_BOT_TOKEN` live
Dev loop = polling, no public URL needed. Webhook path stays stubbed for M12 Vercel deploy. The bot talks to the mock GLM via `/api/triage`, so owner messages get triaged and replied to with zero Z.AI dependency.
- [ ] Install `grammy` as a runtime dep.
- [ ] `lib/telegram.ts` — real grammY client. Exports `sendTelegramMessage(chatId, text)` for use from API routes, and `getBot()` for the polling process. No mock in-memory log.
- [ ] `scripts/start-bot.ts` — long-running polling process. Registers `bot.on("message:text")` → resolves `followup_id` from `chat_id` (see mapping below) → POSTs owner message to `/api/triage` → replies via `sendTelegramMessage` with the decision's `ownerReplyDraft`. Run with `npx tsx scripts/start-bot.ts` in a second terminal alongside `npm run dev`.
- [ ] Chat↔followup mapping: seed your own Telegram chat id into one or two `followups.telegram_chat_id` rows (get your chat id by messaging the bot once and inspecting the update). Resolver = `SELECT * FROM followups WHERE telegram_chat_id = $1 ORDER BY created_at DESC LIMIT 1`.
- [ ] `scripts/send-test-followup.ts` — seeds a new followup row linked to your chat id and sends the opening 24h message. Rehearsal helper.
- [ ] `app/api/telegram/webhook/route.ts` — keep the handler written (same logic as the polling `message:text` hook) but leave `setWebhook` uncalled. Used only when Phase 8-real flips to prod.
- [ ] Smoke: start bot → message from phone → owner reply arrives within 2 s; triage decision visible in the Next.js dev console log.

## Phase M9 — Fake realtime (timed escalation drops)
- [ ] `components/app-shell/demo-realtime.tsx` — when `NEXT_PUBLIC_DEMO_MODE === "true"` OR a hidden dev button is pressed, schedule 2 new escalation cards into `useStore().followups` at fixed delays (8 s, 22 s after mount). Uses the same animation path real Supabase Realtime will use. Exported function named `pushRealtimeFollowup(row)` so Phase 9-real drops a `postgres_changes` handler calling the same function.
- [ ] Pair the existing 4 s "Realtime · new escalation" toast in `app/(app)/dashboard/page.tsx` with an actual card sliding in (`fadeUp` animation + pulsing red dot).
- [ ] Optional second drop at ~15 s to show continuous live feel on the demo recording.

## Phase M10 — Mock corrections feedback
- [ ] `/api/corrections` writes to Supabase `corrections` table (keys live) AND maintains an in-memory `recentCorrections` ring buffer (last 5).
- [ ] Analytics page pulls recent corrections from `/api/analytics` → renders in the existing corrections-log card.
- [ ] `lib/glm.ts` triage fixture accepts a `corrections` context param and console-logs "would-inject" — stub for the real few-shot wiring.
- [ ] `[ ✓ Correct ] [ ✗ Wrong — reason ]` toggle surfaces on every escalation approve/edit (in `escalation-modal.tsx`).

## Phase M11 — Pet passport public page (static OK)
- [ ] `app/(public)/passport/[id]/page.tsx` — public route outside the `(app)` shell. Reads patient + latest visit from Supabase.
- [ ] Replace the procedural QR placeholder in `app/(app)/passport/page.tsx` with a real QR via `qrcode` npm (install this phase only).
- [ ] Static layout, print-friendly. "Download PDF" deferred to demo day.
- [ ] Link/QR from the `(app)` passport page to the `(public)` one.

## Phase M12 — Demo rehearsal + Vercel deploy
- [ ] Yu Han's expanded seed landed in `supabase/seed.sql` (target ~30 patients for prelim, full 150 for finals).
- [ ] `docs/demo-script.md` matching PRD §14.
- [ ] `NEXT_PUBLIC_DEMO_MODE=true` on a Vercel preview; verify mock Telegram pane + realtime drops render on the prod URL.
- [ ] Record demo video. Re-record if any loader feels too fast (<500 ms) or too slow (>2 s).
- [ ] Final `npm run build` + Lighthouse pass.

---

## Backlog — Real integration (unblocks when GLM key + Telegram token arrive)

Grouped by original phase numbers from the pre-mock plan. Each entry: *what the mock does today*, *what to swap*, *files touched*, *deps*.

### Phase 5-real — GLM client (needs `ZAI_API_KEY`)
- **Mock does:** `lib/glm.ts` returns `lib/glm-fixtures.ts` with fake delay.
- **Swap:** replace `lib/glm.ts` body with Z.AI fetch client (retries, JSON parse, error log). Signature unchanged. Keep `lib/prompts.ts` — already wired. `lib/glm-fixtures.ts` can be retained for tests or deleted.
- **Files:** `lib/glm.ts`.
- **Deps:** `ZAI_API_KEY`, `ZAI_MODEL`, `ZAI_BASE_URL` env vars.

### Phase 6-real — Routes hit real GLM
- **Mock does:** routes already call `callGLM()`. Works with fixture or real — no route changes needed.
- **Swap:** after 5-real, re-test `/api/brief`, `/api/consult`, `/api/triage` return real structured output. Add 10-min cache on `/api/brief` per patient. Wire dashboard patient-card expansion to call `/api/brief` (still deferred from Phase 2).
- **Files:** `app/api/brief/route.ts` (cache), `app/api/consult/route.ts`, `app/api/triage/route.ts`, `app/(app)/dashboard/page.tsx` (brief fetch).
- **Deps:** live GLM + Supabase.

### Phase 7-real — LangGraph triage graph
- **Mock does:** `/api/triage` fixture returns one of three decisions, no tool-calling, no multi-turn state.
- **Swap:** add `langgraph/triage_graph.py` (classify → tool_node | route_decision → escalate/monitor/clear). Tools: `request_photo`, `request_temperature`, `request_appetite_timeline`, `request_medication_compliance`, `schedule_doctor_callback`. Cap tool loop depth = 1. Checkpointer `PostgresSaver` on `SUPABASE_DB_URL`, thread id `followup_{followup_id}`. Terminal decision **or** exactly one tool call per turn.
- **Python runtime:** default = FastAPI sidecar (Fly.io/Render). Vercel Python func as fallback.
- **Files:** `langgraph/triage_graph.py`, `langgraph/tools.py`, `langgraph/checkpointer.py`, `app/api/triage/route.ts` (replace GLM call with fetch to sidecar).
- **Deps:** GLM key, `SUPABASE_DB_URL`, sidecar deploy.

### Phase 8-real — Telegram prod deploy
- **Mock does:** polling bot running locally (`scripts/start-bot.ts`) using the real Telegram API. Already real.
- **Swap:** flip from polling to webhook so Telegram pushes updates directly to the Vercel deploy. Add signature verification via `TELEGRAM_WEBHOOK_SECRET`. Call `setWebhook` pointing at the prod URL.
- **Files:** `app/api/telegram/webhook/route.ts` (already written, just needs live routing + signature check), `scripts/set-webhook.ts` (new, one-shot registration), `lib/telegram.ts` (no change).
- **Deps:** deployed URL + `TELEGRAM_WEBHOOK_SECRET` set on Vercel. Stop the local polling process once webhook is registered (only one receiver allowed per bot).

### Phase 9-real — Supabase Realtime
- **Mock does:** `pushRealtimeFollowup(row)` fires on a timer in `components/app-shell/demo-realtime.tsx`.
- **Swap:** in `components/app-shell/store.tsx`, subscribe to `postgres_changes` on `followups` where `status=eq.escalate`; handler calls `pushRealtimeFollowup(row)`. Keep demo-realtime component toggleable for rehearsals.
- **Files:** `components/app-shell/store.tsx`, `components/app-shell/demo-realtime.tsx` (demote to dev-only).
- **Deps:** Realtime enabled on `followups` table.

### Phase 10-real — Corrections few-shot injection
- **Mock does:** corrections write to DB; fixture logs "would-inject".
- **Swap:** in real `lib/glm.ts`, before triage call, fetch last 5 corrections from DB and prepend to prompt as few-shot examples.
- **Files:** `lib/glm.ts`, `lib/prompts.ts` (add few-shot slot).
- **Deps:** GLM live.

### Phase 11-real — Passport extras
- **Mock does:** public page reads from Supabase, renders real QR. Nothing required to swap.
- **Swap:** add "Download PDF" (react-pdf or print-to-PDF) if time allows.
- **Files:** `app/(public)/passport/[id]/page.tsx`.

### Phase 12-real — Validation harness
- **Mock does:** n/a.
- **Swap:** `scripts/validate-triage.ts` runs 50 scenarios through `/api/triage` once GLM is live, prints accuracy matrix (GLM vs keyword baseline) for PRD §15 table.
- **Files:** `scripts/validate-triage.ts`.

---

## Open questions
- Where does the Python LangGraph sidecar live in prod? (Fly.io vs Render vs Vercel Python func.)
- Single clinic hardcoded for prelim — which name/phone on passports + reply sign-offs?
- Demo Telegram account: use Shawn's personal account as the "owner", or set up a second test account? (Judges will see the username in the thread.)
- For the recorded demo video: pre-stage a few Telegram messages so the reply round-trip lands crisp, or take the risk and type live?
- If GLM key arrives mid-weekend: swap during prelim window, or ship mock GLM + real Telegram and swap only for finals?
- Rotate the bot token after prelim (`@BotFather` → `/revoke`) — it's been shared in Claude chat history.
