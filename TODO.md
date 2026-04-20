# Consilium — Build TODO (phased)

Current state: Next.js 16 + React 19 + Tailwind v4 frontend is scaffolded. Routes exist for dashboard, consult, follow-ups, analytics, passport. Mock data lives in `lib/data.ts`. Store is a React context (`components/app-shell/store.tsx`). No backend wired yet.

Blocked on credentials: **Z.AI GLM API key** + **Supabase project URL / anon / service-role / DB URL** + **Telegram bot token**. Everything that needs them is gated to later phases. Earlier phases are runnable now.

Checkpoint rule: finish a phase, run `npm run build` + smoke test, confirm with user before starting the next phase.

---

## Phase 0 — Infra prep (no keys needed) ← START HERE
- [ ] Add `.env.local.example` with every var the app will ever need (Z.AI, Supabase URL/anon/service/DB, Telegram token, app URL) — commit the example, ensure `.env.local` is gitignored.
- [ ] Install runtime deps needed for later phases so we only `npm install` once: `@supabase/supabase-js`, `zod`, `grammy`. (Do NOT install until user okays to avoid lockfile churn — currently only listed.)
- [ ] Create `lib/env.ts` — typed env reader that throws with a clear message when a required var is missing. Mark GLM / Supabase / Telegram as optional-but-warn so app still boots in mock mode.
- [ ] Add a `MOCK_MODE` flag (defaults to on when keys missing). All API routes in later phases branch on this.
- [ ] `npm run build` passes.

## Phase 1 — Domain model + API contracts (no keys)
- [ ] Define shared request/response types in `lib/api-types.ts` (brief, consult, triage, corrections). Zod schemas.
- [ ] Scaffold API routes returning **mock** data so the frontend has a real HTTP surface:
  - `app/api/brief/route.ts` — GET `?patient_id=` → returns brief from `lib/data.ts`.
  - `app/api/consult/route.ts` — POST `{notes, patient_id}` → returns `GLM_CONSULT_OUTPUT`.
  - `app/api/triage/route.ts` — POST `{message, followup_id}` → returns deterministic fake triage based on keywords.
  - `app/api/patients/route.ts` — GET → list. GET `?id=` → one.
  - `app/api/corrections/route.ts` — POST → logs to console, returns ok.
  - `app/api/followups/route.ts` — GET → list.
- [ ] Each route validates input with zod, returns typed JSON.
- [ ] `curl` / browser test each route.

## Phase 2 — Frontend ↔ API wiring (no keys)
- [ ] Replace direct imports of `lib/data.ts` in pages with `fetch("/api/...")` via a thin `lib/api.ts` client.
- [ ] Keep `lib/data.ts` as the mock data source that API routes read from (single source of truth for mock).
- [ ] Dashboard → `/api/patients` + `/api/followups`.
- [ ] Patient card expansion → `/api/brief?patient_id=`.
- [ ] Consult page "Generate" button → `/api/consult` (POST).
- [ ] Escalation approve → `/api/corrections` + local state update.
- [ ] Add optimistic/loading states where missing.
- [ ] Smoke-test full flow in dev; nothing should look different visually.

## Phase 3 — Supabase schema files (no Supabase URL yet)
- [ ] Create `supabase/migrations/0001_init.sql` with schema from PRD §10 (patients, visits, followups, corrections).
- [ ] Create `supabase/seed.sql` — minimal seed drawn from `lib/data.ts` shape (5 patients + 5 followups to start; Yu Han expands to 150 later).
- [ ] Create `lib/supabase.ts` with browser + server-side clients, but only initialised when env vars present.
- [ ] Document in `supabase/README.md`: how to create project, paste URL/keys, run migration + seed.
- [ ] No deploy yet — files only, committed.

---

## ⛔ Everything below needs the Supabase + Z.AI keys.

## Phase 4 — Supabase live (needs Supabase keys)
- [ ] Paste env vars into `.env.local`.
- [ ] Run migration + seed against the Supabase project.
- [ ] Flip `MOCK_MODE` off for `/api/patients`, `/api/followups`, `/api/brief` (read paths first). Routes read from Supabase; fall back to mock if error.
- [ ] Verify dashboard still renders.

## Phase 5 — GLM client + prompts (needs Z.AI key)
- [ ] `lib/glm.ts` — Z.AI client wrapper: `callGLM({system, user, json?: boolean})`. Handles retries, JSON parsing, error logging.
- [ ] `lib/prompts.ts` — three templates from PRD §11 (BRIEF_PROMPT, CONSULT_EXTRACTION_PROMPT, TRIAGE_PROMPT). Parameterised.
- [ ] `lib/billing-matrix.ts` — diagnosis → billable items table (Harrison owns content; stub for now).
- [ ] Smoke test: one-off script `scripts/test-glm.ts` that calls each prompt with sample input and prints output.

## Phase 6 — Route the AI features through GLM (needs both)
- [ ] `/api/brief` → read visits from Supabase → GLM BRIEF_PROMPT → return structured 5-line brief. Cache per patient for 10 min.
- [ ] `/api/consult` → GLM CONSULT_EXTRACTION_PROMPT → insert row into `visits` → return structured output.
- [ ] `/api/triage` (naive version, no LangGraph yet) → GLM TRIAGE_PROMPT → update `followups` row → return decision.
- [ ] Remove the keyword-matching fallback in triage once accuracy verified.

## Phase 7 — LangGraph triage graph (needs both)
- [ ] Add `langgraph/triage_graph.py` (Brandon's territory) with nodes: classify → route → compose_reply.
- [ ] `langgraph/checkpointer.py` wires `PostgresSaver` to `SUPABASE_DB_URL`.
- [ ] Decide Python runtime: (a) small FastAPI sidecar deployed separately, called from `/api/triage`, OR (b) Vercel Python serverless function. Default = (a) for hackathon speed.
- [ ] Replace naive triage in `/api/triage` with a call to the Python service.
- [ ] Verify checkpointer tables appear in Supabase.

## Phase 8 — Telegram bot (needs Telegram token + Supabase live)
- [ ] `lib/telegram.ts` — grammY client + `sendTelegramMessage(chat_id, text)` helper.
- [ ] `app/api/telegram/webhook/route.ts` — receives updates, resolves `followup_id` from `chat_id`, forwards to `/api/triage`.
- [ ] Script `scripts/send-test-followup.ts` that seeds a followup and sends the initial 24h message to a test chat.
- [ ] `setWebhook` script pointing Telegram at the deployed URL.

## Phase 9 — Realtime dashboard (needs Supabase live)
- [ ] Enable Realtime on `followups` table (SQL + dashboard toggle documented).
- [ ] In `components/app-shell/store.tsx`: subscribe to `postgres_changes` where `status=eq.escalate`, push new rows into `followups` state.
- [ ] Visual: fresh escalation cards animate in (use existing motion primitives).
- [ ] Test: trigger an UPDATE from SQL editor, confirm card appears without refresh.

## Phase 10 — Corrections + feedback loop (needs both)
- [ ] `/api/corrections` writes to `corrections` table.
- [ ] Before each GLM call for `feature=triage`, fetch last 5 corrections and inject as few-shot into prompt.
- [ ] Corrections log shown on analytics page sourced from DB (not mock).
- [ ] Toggle in UI: `[ ✓ Correct ] [ ✗ Wrong — reason ]` on every escalation approve/edit.

## Phase 11 — Pet passport (needs Supabase live)
- [ ] `app/(public)/passport/[id]/page.tsx` as public ISR page (current `passport/page.tsx` is a placeholder under `(app)`).
- [ ] Query patient + latest visit.
- [ ] QR code generation (client-side, `qrcode` npm).
- [ ] "Download PDF" button (later; can be defer-to-demo-day).

## Phase 12 — Demo polish + validation (no keys gate)
- [ ] Yu Han's 150-patient seed expanded in `supabase/seed.sql`.
- [ ] `scripts/validate-triage.ts` runs 50 scenarios through `/api/triage`, prints accuracy matrix (GLM vs keyword baseline) — produces the table in PRD §15.
- [ ] Demo rehearsal checklist matching PRD §14 script.
- [ ] Deploy to Vercel, set env vars, verify Telegram webhook points at prod URL.

---

## Open questions to resolve before Phase 7
- Where does the Python LangGraph service live? (Vercel Python func vs Fly.io / Render sidecar.)
- Who runs the Telegram bot in prod — single webhook, or do we poll for dev?
- One clinic hardcoded — which clinic name/phone goes on passports and reply sign-offs?
