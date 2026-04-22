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

## Phase M8 — Real Telegram bot (polling) ✅ DONE — `@consilium_vet_bot`
Dev loop = polling, no public URL. Webhook path written but dormant until M12. Bot talks to mock GLM via the shared handler → real Telegram round-trip with zero Z.AI dependency.
- [x] Installed `grammy` as runtime dep.
- [x] `lib/telegram.ts` — grammY `Bot` singleton (`getBot()`) + `sendTelegramMessage(chatId, text)`.
- [x] `lib/telegram-handler.ts` — `handleOwnerMessage(chatId, text)` shared by polling + webhook. Resolves followup via `telegram_chat_id`, calls `callGLM({feature:"triage"})` directly (no HTTP hop needed), writes decision + differentials back to the followup row, returns `ownerReplyDraft`. Unlinked chats get a friendly fallback with their id so reception can pair them.
- [x] `scripts/start-bot.ts` — polling process. Uses `@next/env` `loadEnvConfig` + dynamic imports so it picks up `.env.local` like Next does. Logs `authenticated as @<username>` on start; handles `/start` with chat-id echo. Run: `npx tsx scripts/start-bot.ts`.
- [x] `scripts/send-test-followup.ts` — seeds a followup row linked to a chat id (and optional patient name) and sends the opening 24h message. Run: `npx tsx scripts/send-test-followup.ts <CHAT_ID> [PATIENT]`.
- [x] `app/api/telegram/webhook/route.ts` — dormant route. Verifies `x-telegram-bot-api-secret-token` against `TELEGRAM_WEBHOOK_SECRET` when set; otherwise open. Same `handleOwnerMessage` + `sendTelegramMessage` flow as polling. `setWebhook` not called — polling wins today.
- [x] Smoke: `npx tsx scripts/start-bot.ts` authenticated as `@consilium_vet_bot` (id 8740499349). `npm run build` green with the new `/api/telegram/webhook` route registered.
- [ ] Demo prep (do-once): run `scripts/send-test-followup.ts` with your personal chat id + "Milo" so a followup row is pre-linked for the rehearsal.

## Phase M10a — Mock tool calling (agentic triage) ✅ DONE
Multi-turn triage: on ambiguous first-turn signals the agent calls a tool (request_photo / request_temperature / request_appetite_timeline) instead of deciding, then commits to a decision on turn 2 with the clarifying reply in context. Console output is colour-coded with reasoning + differentials so judges can watch the agent think during the demo.
- [x] Migration `0003_followups_conversation.sql`: `conversation jsonb[]` + `tool_call_count int` on followups.
- [x] `lib/types.ts` — `ConversationTurn` union (`owner | bot_tool | bot_decision`) + `ToolName`. Extended `FollowUp` with `conversation` + `toolCallCount`. Unified `Differential` across api-types + types.
- [x] `lib/glm-fixtures.ts` — `TriageFixtureOutput = TriageDecision | TriageToolCall`. Strong escalate/clear keywords go terminal on turn 1; ambiguous signals fire tool_call with hand-crafted reasoning per tool (5 tools from PRD §7).
- [x] `lib/telegram-handler.ts` — reads prior conversation + tool_call_count; on tool_call branch appends `bot_tool` turn, increments counter, status stays `pending`; on decision branch appends `bot_decision` turn, updates status + differentials + confidence. Emits boxed ANSI logs: owner inbound → agent reasoning → tool call OR decision → outbound.
- [x] `components/app-shell/escalation-modal.tsx` — renders full conversation thread: owner bubbles, purple tool-call chips showing reasoning + prompt, bordered decision bubble. Falls back to legacy single-quote render when no conversation stored.
- [x] `app/api/followups/route.ts` — SELECT pulls `conversation` + `tool_call_count` so the dashboard gets them.
- [x] `app/api/triage/route.ts` — ad-hoc HTTP callers force `toolCallCount: 1` so the route always resolves to a one-shot decision (bot path uses the multi-turn flow directly).
- [x] Smoke `scripts/test-tool-calling.ts` — seeds followup, runs 2-turn conversation against real DB, asserts tool_call on turn 1 + escalate on turn 2 + 4-turn conversation persisted. Cleans up.

## Phase M9 — Real Supabase Realtime ✅ DONE
Scope changed from "fake timed drops" to real Realtime — the Telegram bot writes actual `followups` rows, so we just subscribe to the live stream instead of faking it.
- [x] Migration `supabase/migrations/0002_realtime_followups.sql`: `alter publication supabase_realtime add table followups;` Applied via Supabase MCP; confirmed via `pg_publication_tables`.
- [x] `components/app-shell/store.tsx` subscribes to `postgres_changes` on `followups` (INSERT + UPDATE) via `getSupabaseBrowser()`. On event: silent refresh (`loadFollowups(true)` skips the skeleton flash) + toast when a row becomes `escalate` for the first time (dedup via `seenEscalationIds` ref).
- [x] Retired the fake 4 s `flashToast` timer in `app/(app)/dashboard/page.tsx` — toast now fires from real Realtime events.
- [x] Smoke: `scripts/test-realtime.ts` subscribes with anon key, triggers UPDATE via service role, receives the event (~3 s after subscribe for the server-side bind). Revert-step included so DB stays demo-ready.
- [ ] In-browser rehearsal: open `/dashboard`, text the bot from phone with "she's bleeding" → escalation card + toast should appear within 1–2 s with no refresh.

## Phase M10 — Mock corrections feedback
- [ ] `/api/corrections` writes to Supabase `corrections` table (keys live) AND maintains an in-memory `recentCorrections` ring buffer (last 5).
- [ ] Analytics page pulls recent corrections from `/api/analytics` → renders in the existing corrections-log card.
- [ ] `lib/glm.ts` triage fixture accepts a `corrections` context param and console-logs "would-inject" — stub for the real few-shot wiring.
- [ ] `[ ✓ Correct ] [ ✗ Wrong — reason ]` toggle surfaces on every escalation approve/edit (in `escalation-modal.tsx`).

## Phase M11 — Pet passport public page ⏸ DEFERRED — see Backlog below
Not in prelim scope. Full spec moved to `### Phase 11-real` in the Backlog section so it can be picked up for finals (or skipped if time tight).

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

### Phase 9-real — Supabase Realtime ✅ landed in M9
No further work. Subscription already live; real Telegram updates flow through the same path prod will use.

### Phase 10-real — Corrections few-shot injection
- **Mock does:** corrections write to DB; fixture logs "would-inject".
- **Swap:** in real `lib/glm.ts`, before triage call, fetch last 5 corrections from DB and prepend to prompt as few-shot examples.
- **Files:** `lib/glm.ts`, `lib/prompts.ts` (add few-shot slot).
- **Deps:** GLM live.

### Phase 11-real — Pet passport (generation + scan → public history page)
Nothing built yet. `app/(app)/passport/page.tsx` is a placeholder with a procedural QR and hardcoded content. Full scope:
- **Internal page** (`app/(app)/passport/page.tsx`, rewrite) — list patients, click one → real QR (via `qrcode` npm) encoding `https://<app>/passport/<patient-uuid>` + preview of the public page + copy-link / print / regenerate buttons.
- **Public page** (`app/(public)/passport/[id]/page.tsx`, new) — standalone, no app shell, mobile-first, SSR from Supabase with ISR `revalidate=60`. Sections:
  - Patient card: name, species, breed, age, sex, microchip, owner *name only* (no phone)
  - Vaccines block: DHPP / Rabies / Lepto with last-given date + next-due status
  - Visit timeline: reverse-chronological, date · diagnosis · short notes
  - Chronic conditions + drug allergies
  - "Notes for next vet" — one-paragraph handover summary
  - Clinic footer: name, address, issued date
  - Print CSS so owners can print for travel
- **Data**: visits table has what we need for the timeline. No vaccinations table — either add `supabase/migrations/0004_vaccinations.sql` (preferred) or overlay from `lib/data.ts` the way briefs do.
- **Security note**: UUIDs aren't guessable enough to matter but aren't secrets either. Keep PII off the public page (no phone, no address).
- **Demo scan logistics**:
  - **Option A** (real scan on camera): requires Vercel deploy first — use live URL in the QR. Best for the video. +30 min for deploy.
  - **Option B** (fake on camera): show QR, cut to browser at the URL. Works for video without deploy.
- **PDF export**: defer to demo day if time allows (react-pdf or client print-to-PDF).
- **Dep**: `qrcode` (~5 KB).
- **Files**: `app/(public)/passport/[id]/page.tsx`, `app/(app)/passport/page.tsx`, `lib/data.ts` (vaccine overlay), optional `supabase/migrations/0004_vaccinations.sql`.
- **Time**: ~90 min for the pages + QR, +30 min if deploying for real scan.

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
