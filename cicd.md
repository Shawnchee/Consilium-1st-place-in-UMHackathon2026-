# Consilium — Deployment Plan

This document is the operational deployment plan for **Consilium**, the AI decision copilot for veterinary clinics built for UMHackathon 2026 (Final Round). It covers environments, CI/CD, secret management, rollback strategy, observability, and risks.

The plan deliberately stays at the level a small team can actually run — no Kubernetes, no Terraform, no aspirational infrastructure. Every step described here matches the code currently in this repository.

Live build: <https://consilium-tau.vercel.app>
Repository: <https://github.com/Shawnchee/DA-Homies>

---

## 1. Project Overview

Consilium is a single-tenant web app + Telegram bot that runs the full clinical loop for a solo vet clinic:

- **Pre-consult** — Claude Haiku 4.5 produces a 5-line patient brief on the dashboard.
- **During consult** — Claude Sonnet 4.6 captures voice (Deepgram nova-3) + photos (vision) and emits structured SOAP / Rx / billing / todos.
- **Post-discharge** — owners chat with `@consilium_vet_bot` on Telegram; Sonnet 4.6 runs a tool-use loop and emits a `clear` / `monitor` / `escalate` decision. Escalations surface on the doctor dashboard live via Supabase Realtime.

**Users:** solo vets (primary), clinic receptionists, and pet owners (Telegram only — never see the web app).

**Tech stack** (full table in [`README.md`](./README.md)):

| Layer | Tool |
|---|---|
| Web app + API | Next.js 16 (App Router) + React 19 on Vercel |
| Reasoning + vision | Anthropic Claude (Haiku 4.5 / Sonnet 4.6) |
| Speech-to-text | Deepgram nova-3 |
| Web search tool | Tavily (cached 7 days in Postgres) |
| Telegram bot | grammY — polling in dev, webhook in prod |
| Database + Realtime + Storage | Supabase (Postgres) |
| Agent sidecar | Python FastAPI + LangGraph (`agent/`) — deferred to finals |
| CI | GitHub Actions (AI eval, clinic-brain-sync cron) |

The Next.js app and Python LangGraph sidecar live in the same monorepo but deploy to different platforms (Vercel + Railway/Render) because Vercel's serverless function size and runtime aren't a fit for the LangGraph triage graph.

---

## 2. Deployment Objectives

Successful deployment means we can demo and ship without a dedicated ops engineer:

- **Reproducible**: every production deploy comes from a tagged commit on `main` — no machine-specific build steps.
- **Fast**: Vercel preview build under 3 min; production promotion under 5 min end-to-end.
- **Secret-safe**: zero secrets in the repo; every key lives in Vercel Project Settings or GitHub Repo Secrets.
- **Telegram-stable**: webhook delivery survives deploy (no `409 Conflict` from a leftover polling process).
- **Reversible**: any production deploy can be rolled back in under 2 min via Vercel "Promote previous deployment".
- **Observable enough for a 3-clinic pilot**: Vercel function logs + Supabase logs + GitHub Actions runs are sufficient — we do not need APM yet.

---

## 3. Deployment Architecture

### 3.1 Production topology

```
                   ┌────────────────────────┐
                   │   Pet Owner (Telegram) │
                   └───────────┬────────────┘
                               │  HTTPS webhook
                               ▼
        ┌────────────────────────────────────────────────────┐
        │  Vercel — Next.js 16 (App Router)                  │
        │                                                    │
        │   /dashboard  /consult  /follow-ups  /analytics    │
        │   /receptionist  /passport                         │
        │                                                    │
        │   API routes (Node serverless):                    │
        │     POST /api/brief        → Claude Haiku 4.5      │
        │     POST /api/consult      → Claude Sonnet 4.6     │
        │     POST /api/triage       → Claude Sonnet 4.6     │
        │                              (tool-use loop)       │
        │     POST /api/transcribe   → Deepgram nova-3       │
        │     POST /api/upload       → Supabase Storage      │
        │     POST /api/telegram/webhook  (verifies secret)  │
        │     POST /api/cron/consolidate-memory              │
        │     POST /api/corrections, /api/passports, ...     │
        └─────────┬──────────────────────────────────────────┘
                  │
   ┌──────────────┼─────────────────────────────────────────┐
   ▼              ▼                                         ▼
┌─────────┐  ┌─────────┐  ┌──────────────────────────────────┐
│Anthropic│  │Deepgram │  │  Supabase                        │
│ Claude  │  │ nova-3  │  │  • Postgres (patients/visits/    │
│  API    │  │   STT   │  │    followups/corrections/        │
└─────────┘  └─────────┘  │    passports/tavily_cache)       │
                          │  • Realtime (dashboard updates)  │
┌─────────┐               │  • Storage (consult-photos /     │
│ Tavily  │               │    owner-photos buckets)         │
│ Search  │               └──────────────────────────────────┘
└─────────┘

        ┌────────────────────────────────────────────────────┐
        │  Railway/Render — Python FastAPI + LangGraph       │
        │   agent/server.py  (root dir = agent/)             │
        │   triage_graph: clarify → decide → emit            │
        └────────────────────────────────────────────────────┘
                  ▲
                  │  LANGGRAPH_SERVICE_URL (server-side only)
                  │
        ┌─────────┴────────┐
        │  Next.js API     │  (deferred — TS tool-use loop in
        │  (when enabled)  │   lib/llm.ts handles all flows today)
        └──────────────────┘
```

### 3.2 Request flow (owner Telegram message → escalation card)

1. Owner sends message to `@consilium_vet_bot`.
2. Telegram POSTs to `https://<app>/api/telegram/webhook` with header `X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>`.
3. Webhook route (`app/api/telegram/webhook/route.ts`) verifies the secret, then hands the update to `lib/telegram-handler.ts` (shared with the polling dev path).
4. Handler resolves the chat-id → `followups` row → patient context, downloads any photo to Supabase Storage, then calls `lib/llm.ts` with the conversation history.
5. Claude Sonnet 4.6 runs the tool-use loop. If it emits `request_photo` / `request_temperature` etc., the bot asks the owner a clarifying question. If it emits `emit_decision`, the row is updated with `decision = clear | monitor | escalate`.
6. Supabase Realtime pushes the row update to any open `/dashboard` browser tab. The escalation card appears within 1–2 seconds.

### 3.3 Failure fallback

- **Claude API down** → server route returns a structured fallback (`status: "agent_unavailable"`); Telegram sends a holding reply ("Got it — the doctor will follow up directly"); the row is left in `pending` state for manual triage.
- **Tavily down or `TAVILY_API_KEY` unset** → tool registry omits `tavily_search`; Claude proceeds without web context.
- **Supabase Storage bucket missing** → photo handler falls back to inline base64 (still works, no public URL).
- **`ANTHROPIC_API_KEY` unset** → app boots in **mock mode**; every page renders from `lib/glm-fixtures.ts` with no network calls. Useful for first deploy / smoke test.

---

## 4. Environment Configuration

All env vars are documented in [`.env.local.example`](./.env.local.example). Three deployment environments:

| Environment | Where | Trigger | Notes |
|---|---|---|---|
| **Local dev** | developer laptop | `npm run dev` + `npx tsx scripts/start-bot.ts` | Polling bot; mock mode if no API key |
| **Vercel Preview** | per-PR URL | every push to a non-`main` branch | Telegram webhook is **not** rewired — preview URLs do not handle bot traffic |
| **Production** | `consilium-tau.vercel.app` | merge / push to `main` | Single source of truth for the live `@consilium_vet_bot` webhook |

### 4.1 Required env vars (production)

| Variable | Source | Required? |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | static — `https://consilium-tau.vercel.app` | yes (used to register the Telegram webhook URL) |
| `ANTHROPIC_API_KEY` | console.anthropic.com | yes — without it, app stays in mock mode |
| `DEEPGRAM_API_KEY` | console.deepgram.com | yes — required for `/api/transcribe` |
| `TAVILY_API_KEY` | app.tavily.com | optional — gracefully omitted if missing |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API | yes — server-only, never exposed to client |
| `SUPABASE_DB_URL` | Supabase Settings → Database → Connection string (URI) | yes — used by `agent/consolidate.py` |
| `TELEGRAM_BOT_TOKEN` | @BotFather | yes |
| `TELEGRAM_WEBHOOK_SECRET` | random 32-byte hex | **yes in production** — `app/api/telegram/webhook/route.ts` refuses to serve when `NODE_ENV=production` and this is unset |
| `NEXT_PUBLIC_CLINIC_ID/NAME/DOCTOR/PHONE` | clinic config | optional — defaults bake the demo identity at build time |
| `LANGGRAPH_SERVICE_URL` | Railway/Render | only if Python sidecar is enabled |

### 4.2 Per-feature model overrides

Default models are baked into `lib/llm.ts`. Override only when a regression hits:

- `ANTHROPIC_MODEL_BRIEF` (default `claude-haiku-4-5-20251001`)
- `ANTHROPIC_MODEL_CONSULT` (default `claude-sonnet-4-6`)
- `ANTHROPIC_MODEL_TRIAGE` (default `claude-sonnet-4-6`)

### 4.3 Secret management

- **Web app** — Vercel Project Settings → Environment Variables, scoped to `Production` / `Preview` / `Development` separately. `NEXT_PUBLIC_*` values are inlined at build time, so changing them requires a redeploy, not just a restart.
- **GitHub Actions** — Repo Settings → Secrets and variables → Actions. Used by `clinic-brain-sync.yml` (consolidation cron) and `ai-eval.yml` (PR eval).
- **Local dev** — `.env.local` (gitignored). Never commit.

Rotation procedure: rotate the key with the upstream provider, paste the new value in Vercel + GitHub Secrets, redeploy. Old key can stay valid for ~10 min during the swap.

---

## 5. CI/CD and Deployment Workflow

### 5.1 Branch strategy

- `main` is the production branch. Direct pushes are allowed for hackathon velocity but every meaningful change goes via PR so the AI eval workflow runs.
- Feature branches use `feat/<scope>` or `fix/<scope>`. Vercel auto-creates preview URLs.
- No long-lived `dev` or `staging` branches — preview URLs are the staging environment.

### 5.2 End-to-end deploy flow

```
git push origin <branch>
    │
    ├─→ GitHub Actions
    │     ├─ ai-eval.yml      (only runs if agent/** changed)
    │     └─ db-migrate.yml   (only runs on push to main)
    │
    └─→ Vercel
          ├─ detects Next.js, runs `next build`
          ├─ injects env vars (Production or Preview)
          ├─ deploys serverless functions
          └─ promotes to production URL (only on `main`)
```

### 5.3 Vercel ignored-build-step (skip build when only Python changed)

In Vercel Project Settings → Git → Ignored Build Step:

```bash
git diff --quiet HEAD^ HEAD ./app ./components ./lib ./public ./supabase package.json package-lock.json
```

Translation: skip the Vercel build when the diff touches only `agent/` or top-level docs. Saves build minutes during agent-only work.

### 5.4 AI eval pipeline (`.github/workflows/ai-eval.yml`)

Standard unit tests don't catch prompt regressions. We run a 15-case eval against the triage agent on every PR that touches `agent/**`:

- 5 **Escalate** scenarios (severe vomiting post-op, seizures, bleeding wound, etc.)
- 5 **Monitor** scenarios (mild lethargy, missing one meal, etc.)
- 5 **Clear** scenarios ("eating normally", "back to baseline")

Each test asserts `decision == expected_decision`. A flipped decision fails the PR.

```python
@pytest.mark.parametrize("scenario", load_15_test_cases())
async def test_agent_safety(scenario):
    response = await triage_agent_node({
        "text": scenario["human_message"],
        "conversation_text": "",
        "tool_call_count": 0,
    })
    assert response["output"].decision == scenario["expected_decision"]
```

`ANTHROPIC_API_KEY` is provided via GitHub Secrets. The job has a 10-minute timeout — 15 calls finish well under that.

### 5.5 Database migrations (`.github/workflows/db-migrate.yml`)

Migrations live in `supabase/migrations/*.sql` (currently `0001`–`0009`). Locally:

```bash
supabase db diff -f add_appointments_table
```

On push to `main`, the workflow runs `supabase db push` against the project, using `SUPABASE_PROJECT_ID` and `SUPABASE_DB_PASSWORD` from GitHub Secrets. Migrations are forward-only; rolling back a schema change requires a new migration.

---

## 6. Step-by-Step Deployment Process

### Step 1 — Deploy Next.js to Vercel

1. Push the repo to GitHub.
2. In Vercel → New Project → Import the repo. Framework auto-detected as Next.js.
3. **Build settings**: leave defaults (`next build`, output `.next`).
4. **Environment variables**: paste every required var from §4.1 into the Production scope.
5. **Ignored Build Step**: paste the snippet from §5.3.
6. Click Deploy. First build takes ~2–3 min.
7. Smoke test the production URL — `/` should render the marketing page; `/dashboard` should render with seed data (if Supabase env vars are set) or fixtures (if not).

### Step 2 — Provision Supabase

1. Create a Supabase project. Copy `URL`, `anon key`, `service_role key`, and the database connection string into Vercel + GitHub Secrets.
2. Apply migrations in order:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   Or via the SQL editor: paste each `supabase/migrations/000N_*.sql` in order, then `supabase/seed.sql`.
3. Verify `0005_storage_buckets.sql` ran — confirms `consult-photos` and `owner-photos` public buckets exist. Without these, photo uploads silently fall back to inline base64 (works, but no audit trail).
4. Verify `0002_realtime_followups.sql` and `0008_realtime_patients.sql` enabled Realtime on those tables — the dashboard live updates depend on them.

### Step 3 — Configure the Telegram bot

1. Create the bot with @BotFather; copy the token to `TELEGRAM_BOT_TOKEN` (Vercel + GitHub Secrets).
2. Generate a webhook secret: `openssl rand -hex 32`. Set as `TELEGRAM_WEBHOOK_SECRET` in Vercel.
3. **Stop any local polling process** (`pkill -f scripts/start-bot.ts`). Telegram allows only one consumer per bot — running both produces `409 Conflict`.
4. Register the webhook (one-time):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://consilium-tau.vercel.app/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
5. Send `/start` to the bot from a test account — should reply with the chat id.
6. Seed a follow-up linked to that chat id and reply with one of each branch (clear / monitor / escalate) to validate end-to-end.

### Step 4 — (Optional) Deploy the Python LangGraph sidecar

Only required if `LANGGRAPH_SERVICE_URL` is set and the TS path in `lib/llm.ts` is wired through. Currently deferred — the TS tool-use loop handles all flows.

1. Connect the same GitHub repo to Railway or Render.
2. **Root Directory** → `agent`.
3. **Start command** → `fastapi run server.py --host 0.0.0.0`.
4. Add env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLINIC_ID`.
5. Deploy. Copy the public URL into Vercel as `LANGGRAPH_SERVICE_URL`.
6. Smoke test: `curl <url>/health` should return `{"ok": true}`.

### Step 5 — Production validation checklist

After every production deploy, walk through this list manually:

- [ ] `/` renders the marketing page with the dog mascot.
- [ ] `/receptionist` → "Load demo data" → "Send to Dr. Amirah" succeeds (Supabase write).
- [ ] `/dashboard` → realtime banner appears within 2s of the receptionist push.
- [ ] `/consult` → record voice (5+ sec) → transcript lands (Deepgram).
- [ ] `/consult` → "Generate structured output" → SOAP / Rx / billing / todos populate.
- [ ] Send a Telegram message → bot replies; for "bleeding from incision and won't stand" the dashboard shows an escalation card.
- [ ] Open the passport link from Telegram → renders, QR scannable.

If any step fails, roll back (§8).

### Step 6 — Schedulers

**Clinic Brain Sync** (`.github/workflows/clinic-brain-sync.yml`):

- Runs daily at 02:00 UTC (`cron: '0 2 * * *'`).
- Executes `agent/consolidate.py`, which performs **incremental consolidation** by checking the `updated_at` watermark in the LangGraph store — only new corrections since the last sync are processed.
- Output: synthesized "Clinic SOPs" and "Clinical Trends" written back to Supabase, used as few-shot context for future Claude calls.
- Manual trigger available via GitHub → Actions → "Run workflow".
- Required GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_DB_URL`, `CLINIC_ID`.

A Vercel-side cron alternative exists at `app/api/cron/consolidate-memory/route.ts`. Run **one or the other**, not both.

---

## 7. Monitoring and Error Handling

### 7.1 Where logs live

| Surface | Source | Use for |
|---|---|---|
| Vercel → Project → Logs | function invocation logs | API errors, latency, cold-start spikes |
| Vercel → Project → Deployments | build logs | failed builds, env-var typos |
| Supabase → Logs → Postgres / Realtime / Storage | DB + realtime + storage events | RLS denials, slow queries, bucket errors |
| GitHub → Actions | workflow runs | AI eval failures, migration failures, cron output |
| Polling bot terminal (dev only) | `scripts/start-bot.ts` | colour-coded boxes for owner inbound, agent reasoning, tool call, decision, outbound |

### 7.2 Failure handling already in code

- **Telegram webhook**: returns 200 even on internal errors so Telegram does not retry-storm; errors are logged to Vercel.
- **Claude API failure**: tool-use loop in `lib/llm.ts` catches and returns a fallback decision shape. The Telegram handler sends a holding reply to the owner.
- **Deepgram timeout**: `/api/transcribe` returns `{ ok: false, reason: "stt_unavailable" }`; the consult UI shows an inline error and keeps the recording so the user can retry.
- **Tavily failure or rate-limit**: cached lookups in `tavily_cache` cover the last 7 days; on miss, Claude proceeds without web context (logged at `info`).
- **Supabase Storage missing**: handler in `lib/storage.ts` falls back to inline base64.

### 7.3 What we do *not* yet have

- No APM (Sentry, Datadog) — see §10.
- No paging / on-call rotation — single-developer pilot.
- No SLO definitions yet. Internal target: P95 triage latency under 8s; webhook delivery success > 99%.

---

## 8. Rollback Plan

### 8.1 When to roll back

Roll back immediately if any of these are observed in production:

- Telegram webhook returns 5xx on multiple consecutive owner messages.
- `/api/triage` or `/api/consult` P95 latency exceeds 15s for 5 consecutive minutes.
- Doctor dashboard fails to load or the realtime escalation card stops appearing.
- A regression in the AI eval is discovered post-merge (e.g. a `monitor` case now flips to `clear`).
- Auth / Supabase RLS suddenly denies queries that worked yesterday.

### 8.2 Rollback steps (target: under 2 minutes)

1. Vercel → Project → Deployments → find the last known-good deployment → **Promote to Production**. This is instant — no rebuild.
2. If the issue was an env-var change, restore the previous value in Project Settings → Environment Variables (Vercel keeps history) and redeploy.
3. If the issue was the Telegram webhook URL, re-register against the rolled-back deployment URL using the `setWebhook` curl from §6 step 3.
4. If the issue is a bad migration, write a forward-only fix migration — **do not** edit the existing migration file. Open a hotfix PR to `main`.
5. Post a one-line incident note in the team chat with the rolled-back commit SHA and the symptom.

### 8.3 What rollback cannot fix

- **Schema migrations** that already ran are not reverted by a Vercel rollback. Forward-only fix migration is the only safe path.
- **Telegram messages already sent** to owners cannot be unsent. If a bad triage shipped, a follow-up message and a corrections-table entry are the right response.
- **Supabase data writes** are not transactional with the deploy. A rollback may leave rows that reference fields the older code does not know about.

---

## 9. Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Telegram webhook fails after a deploy | Medium | High — owners stop reaching the clinic | Deploy validation checklist (§6 step 5); webhook secret pre-checked in `app/api/telegram/webhook/route.ts` |
| Two bot processes (polling + webhook) collide | Medium | High — `409 Conflict`, no inbound messages | Pre-deploy: `pkill -f scripts/start-bot.ts`; production never runs the polling script |
| Claude API outage or rate limit | Low | High — agent flows degrade | Fallback shape returned to user; mock-mode boots the app even with no key |
| Deepgram outage | Low | Medium | Voice capture fails gracefully; doctor falls back to typed notes |
| Tavily rate-limit | Medium | Low | 7-day cache in `tavily_cache`; tool omitted entirely if key absent |
| Bad migration on `main` | Low | High — production DB drift | Forward-only fix migration; never edit applied SQL files |
| AI eval regression slips through | Medium | High — clinical safety | `ai-eval.yml` blocks PR merge; doctor reviews every send before transmit |
| Leaked `SUPABASE_SERVICE_ROLE_KEY` | Low | Critical | Vercel env vars are scoped server-only; rotate via Supabase + Vercel + GitHub Secrets |
| Missing `NEXT_PUBLIC_CLINIC_*` at build | Low | Low | Defaults baked in `lib/clinic.ts`; app builds without them |
| Storage bucket missing | Low | Low | Inline base64 fallback in `lib/storage.ts` |
| Webhook secret unset in prod | Low | High — webhook refuses to serve | Webhook route enforces this in `NODE_ENV=production`; surfaces immediately on first request |

---

## 10. Future Improvements

These are out of scope for the hackathon submission but are the natural next steps for a real pilot:

- **Sentry / OpenTelemetry**: capture exceptions and traces across `/api/triage` and the Telegram webhook so the AI eval cases are not the only signal.
- **Background queue (Inngest or a Redis worker)**: move `agent/consolidate.py` off GitHub Actions onto an event-driven queue so consolidation can happen on every correction, not just nightly.
- **Multi-tenant clinic deployment**: introduce a `clinic_id` foreign key on every table and an RLS policy per clinic; today the `NEXT_PUBLIC_CLINIC_*` env model is single-tenant.
- **Migration testing in CI**: spin up a Supabase shadow DB in `db-migrate.yml` and apply migrations there before production push.
- **Deepgram streaming**: replace the batch `/api/transcribe` path with WebSocket streaming so doctors see transcripts word-by-word.
- **Per-clinic AI eval datasets**: extend the 15-case eval with the corrections logged by each pilot clinic, so prompt regressions are caught against real clinical patterns.
- **LangGraph sidecar promotion**: wire `LANGGRAPH_SERVICE_URL` into `lib/llm.ts` for the triage flow and run the TS path in shadow mode to validate parity before cutover.
- **Usage + cost dashboards**: surface Claude / Deepgram / Tavily spend per clinic so pricing tiers can be calibrated against real unit economics.

---

## Appendix — Quick reference

- **Production URL**: <https://consilium-tau.vercel.app>
- **Bot**: [`@consilium_vet_bot`](https://t.me/consilium_vet_bot)
- **Repo**: <https://github.com/Shawnchee/DA-Homies>
- **Migrations**: `supabase/migrations/0001`–`0009`
- **Workflows**: `.github/workflows/ai-eval.yml`, `clinic-brain-sync.yml`
- **Env reference**: [`.env.local.example`](./.env.local.example)
- **Architecture deep dive**: [`SAD.pdf`](./SAD.pdf)
- **Demo runbook**: [`flow.md`](./flow.md)
