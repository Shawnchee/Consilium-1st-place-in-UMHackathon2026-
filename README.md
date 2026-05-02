# Consilium

**AI Decision Copilot for Veterinary Clinics** — built for UMHackathon 2026 (Final Round).

> *Latin: medical council / advice.* The AI that thinks before the consult, acts after it.

Consilium gives solo vet clinics an AI copilot that briefs the doctor before every consult, captures and structures clinical notes during it, and autonomously follows up with owners after — escalating only the cases that genuinely need the doctor's eyes.

🔗 **Repository:** <https://github.com/Shawnchee/DA-Homies>
🌐 **Live demo:** <https://consilium-tau.vercel.app>

---

## 📦 Final Round Deliverables

All five required submission artifacts are checked into this repository for easy access. Every PDF document carries the **Z AI** and **YTL AI Labs** logos on the cover page as required by the submission guidelines.

| # | Deliverable | File | Description |
|---|---|---|---|
| 1 | 💾 **Code Repository** | <https://github.com/Shawnchee/DA-Homies> | Full source — Next.js 16 + Claude (Haiku 4.5 / Sonnet 4.6) + Supabase + grammY Telegram bot. Live build at <https://consilium-tau.vercel.app>. |
| 2 | 🧪 **Refined QA Testing Document** | [`Refined QATD.pdf`](./Refined%20QATD.pdf) — source: [`refined_qa.md`](./refined_qa.md) | Updated test strategy, expanded test matrix, coverage, defect tracking and regression plan for the final round. |
| 3 | 🚀 **Deployment Plan** | [`Deployment Plan.pdf`](./Deployment%20Plan.pdf) — source: [`cicd.md`](./cicd.md) | Environments, CI/CD pipeline, secret management, rollback strategy, observability, on-call runbooks. |
| 4 | 📈 **Business Proposal** | [`Business Proposal.pdf`](./Business%20Proposal.pdf) — source: [`business_proposal.md`](./business_proposal.md) | Market sizing, pricing tiers, go-to-market motion, unit economics, and financial model for the developed product. |
| 5 | 🎤 **Final Round Pitch Deck** | [`Consilium Pitch Deck.pdf`](./Consilium%20Pitch%20Deck.pdf) | Final-round presentation slides covering problem, solution, decision layer, demo highlights, traction, and ask. |

📁 **Full submission Drive folder:** <https://drive.google.com/drive/u/0/folders/160O04WT0iuOfyCdfYf1EiLhesZAOUw5k>

### Earlier-round artifacts (kept for reference)

| Deliverable | File |
|---|---|
| 📘 PRD (Product Requirements) | [`PRD.pdf`](./PRD.pdf) |
| 🏛️ SAD (System Architecture) | [`SAD.pdf`](./SAD.pdf) |
| 🧪 QATD (initial QA document) | [`QATD.pdf`](./QATD.pdf) — superseded by Refined QATD above |

---

## 🎥 Pitch Video (10-minute demo)

> **▶️ Watch the pitch + product demo:** **<https://drive.google.com/file/d/1XFIBHLVO8OItMsTh8jcMqsAVfZDE3XTE/view?usp=drive_link>**

The video walks through the problem, the three-stage decision layer (pre-consult brief → consult capture → post-discharge triage), and a live end-to-end demo of the Telegram-based owner follow-up triggering an escalation card on the doctor dashboard.

---

## Try the Telegram bot

The owner-facing follow-up channel is live on Telegram as [`@consilium_vet_bot`](https://t.me/consilium_vet_bot). A real grammY bot talks to the Claude triage agent (Sonnet 4.6) and writes decisions back to Supabase, which the dashboard picks up over Realtime.

### One-time setup

1. Copy `.env.local.example` → `.env.local` and fill in:
   - `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com/) — required to leave mock mode)
   - `DEEPGRAM_API_KEY` (from [console.deepgram.com](https://console.deepgram.com/) — $200 free credit on signup, required for voice consult capture)
   - `TAVILY_API_KEY` (from [app.tavily.com](https://app.tavily.com/) — 1k free searches/mo, required for the LLM's web-search tool)
   - `TELEGRAM_BOT_TOKEN` (from @BotFather)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. `npm install`
3. Apply migrations + seed (via Supabase MCP or psql): `supabase/migrations/*.sql` then `supabase/seed.sql`.
   - `0004_tavily_cache.sql` is optional — without it Tavily still works, just uncached.
   - `0005_storage_buckets.sql` is recommended for production — without it photos work but use inline base64 instead of public Storage URLs (no audit trail, no dashboard thumbnails).

### Run the bot

In one terminal, start Next:

```bash
npm run dev                        # http://localhost:3000
```

In a second terminal, start the polling bot:

```bash
npx tsx scripts/start-bot.ts
```

You should see `[bot] authenticated as @consilium_vet_bot ...`.

### Pair your chat to a follow-up

1. Open Telegram → message `@consilium_vet_bot` with `/start`. It replies with your chat id.
2. Seed a follow-up row linked to that chat id (optionally for a specific patient, e.g. `Milo`):

   ```bash
   npx tsx scripts/send-test-followup.ts <CHAT_ID> [PATIENT_NAME]
   ```

   The bot sends the 24h opener in Telegram and creates a `followups` row in Supabase.

### Talk to the agent

Reply in Telegram. Examples of what each branch looks like:

- **Clear** — "She ate breakfast and is bouncing around like normal." → bot confirms, decision `clear`.
- **Monitor** — "Eating a little, still a bit slow but better than yesterday." → bot acknowledges, decision `monitor`.
- **Escalate** — "She's bleeding from the incision and won't stand." → bot flags urgent, decision `escalate`, and the `/dashboard` page surfaces an escalation card within 1–2 seconds via Supabase Realtime.
- **Tool call (ambiguous)** — "Not sure, seems off." → on turn 1 the agent calls a tool (e.g. `request_photo`, `request_temperature`, `request_appetite_timeline`) and asks a clarifying question. Your next reply commits to a terminal decision.
- **Owner photo** — send a photo (with or without caption) → the bot downloads it, persists to the `owner-photos` Supabase Storage bucket, and Claude vision factors it into the differential alongside the conversation history. The terminal log shows the public URL.

Watch the terminal running `start-bot.ts` — you'll see colour-coded boxes for owner inbound, agent reasoning, tool call or decision, and the outbound reply. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) in parallel to see the escalation card appear live.

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| App framework | **Next.js 16** (App Router) + **React 19** | Frontend + API routes in one repo, deploys as one unit |
| Styling | **Tailwind CSS v4** | Utility-first styling |
| Motion / 3D | **motion**, **three.js** (r184) | Dog mascot cursor tracking + page transitions |
| Reasoning + vision | **Anthropic Claude** — Haiku 4.5 (brief), Sonnet 4.6 (consult, triage) | Multimodal: wound photos / lab images / X-rays pass alongside text. Per-feature model overrides via env. |
| LLM tool-use | `tavily_search` (server-executed) + 5 user-facing clarifying tools (`request_photo`, `request_temperature`, `request_appetite_timeline`, `request_medication_compliance`, `schedule_doctor_callback`) + `emit_*` structured-output tools | See `lib/tools/registry.ts`. Tavily results are 7-day cached in `tavily_cache`. |
| Speech-to-text | **Deepgram nova-3** | Voice consult dictation via `POST /api/transcribe`. Auto language detection (Bahasa / English / Mandarin code-switching). |
| Web-search | **Tavily** | Drug-recall + fresh clinical guidance lookups. Optional — when key is absent, Claude proceeds without web context. |
| Telegram bot | **grammY** (TypeScript) | Polling in dev (`scripts/start-bot.ts`), webhook route (`app/api/telegram/webhook`) ready for prod |
| Database | **Supabase (PostgreSQL)** | Patients / visits / followups / corrections + `tavily_cache` |
| Realtime | **Supabase Realtime** | Dashboard live updates the moment a triage decision is written |
| File storage | **Supabase Storage** | `consult-photos` + `owner-photos` public buckets — inline base64 fallback when buckets are missing |
| Agent framework | **LangGraph** (Python sidecar) | Deferred to finals. Today's TS tool-use loop in `lib/llm.ts` handles all flows. |
| Deployment | **Vercel** | One-command deploy, free tier |
| Demo data | Synthetic JSON seed | 150 patients, 10 diagnoses, 3 recovery patterns |

---

## Architecture

### High-level system view

```
┌────────────────────────┐       ┌────────────────────────────────────┐
│   Pet Owner (Telegram) │◄─────►│  Telegram Bot (grammY)             │
└────────────────────────┘       │   • polling (dev)                  │
                                 │   • webhook (prod)                 │
                                 └──────────────┬─────────────────────┘
                                                │ shared handler
                                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Next.js 16 (App Router) — single repo                 │
│                                                                     │
│   App pages (React 19 + Tailwind v4 + three.js):                    │
│     • /dashboard   /consult   /follow-ups   /analytics   /passport  │
│                                                                     │
│   API routes:                                                       │
│     POST /api/brief        ← Claude Haiku 4.5  (emit_brief)         │
│     POST /api/consult      ← Claude Sonnet 4.6 (emit_consult +      │
│                              tavily_search, multimodal)             │
│     POST /api/triage       ← Claude Sonnet 4.6 (tool-use loop:      │
│                              clarifying × 1 OR emit_decision)       │
│     POST /api/transcribe   ← Deepgram nova-3                        │
│     POST /api/upload       ← Supabase Storage                       │
│     POST /api/corrections  ← feedback loop (few-shot)               │
│     POST /api/telegram/webhook                                      │
│                                                                     │
│   lib/llm.ts  ── tool-use loop, vision, per-feature model routing   │
│   lib/tools/  ── tavily + clarifying + emit tool registry           │
│   lib/prompts.ts ── system prompts with guardrails                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
        ┌──────────────┼─────────────────────────────────┐
        ▼              ▼                                 ▼
┌──────────────┐ ┌─────────────┐  ┌──────────────────────────────────┐
│  Anthropic   │ │  Deepgram   │  │  Supabase                        │
│  Claude API  │ │  nova-3 STT │  │  • Postgres (patients/visits/    │
│  (Haiku 4.5  │ │             │  │    followups/corrections/        │
│   + Sonnet   │ │             │  │    tavily_cache)                 │
│   4.6)       │ │             │  │  • Realtime (dashboard updates)  │
└──────────────┘ └─────────────┘  │  • Storage (consult-/owner-      │
                                  │    photos buckets, public)       │
┌─────────────┐                   └──────────────────────────────────┘
│   Tavily    │
│   Search    │
│   API       │ (tool-called by Claude during consult / triage when
└─────────────┘  drug-recall or fresh-guidance check is needed)
```

### Decision-layer flow (the core thesis)

```
   BEFORE                       DURING                          AFTER
   ──────                       ──────                          ─────
                                                       ┌──────────────────┐
[F1] Pre-consult brief    [F2] Consult capture         │ [F3] Telegram    │
     Haiku 4.5                 Sonnet 4.6              │      follow-up   │
     emit_brief                emit_consult            │      Sonnet 4.6  │
        │                      + tavily_search         │      tool loop   │
        ▼                      + vision (photos)       │                  │
  5-line patient                  │                    │  clear / monitor │
  briefing card                   ▼                    │  / escalate      │
                          SOAP + Rx + billing          └────────┬─────────┘
                          + todos                              │
                                                               ▼
                                                      [F4] Doctor dashboard
                                                           Realtime escalation
                                                                │
                                                                ▼
                                                      [F5] Doctor approves /
                                                           edits  →  feeds
                                                           back as few-shot
                                                                │
                                                                ▼
                                                      [F6] Pet passport
                                                           auto-updated
```

For the full architecture (sequence diagrams, deployment topology, security model), see [`SAD.pdf`](./SAD.pdf).

---

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in keys as you get them
npm run dev                        # http://localhost:3000
```

The app boots in **mock mode** when `ANTHROPIC_API_KEY` is missing — every page renders from `lib/data.ts` / `lib/glm-fixtures.ts` and no network calls are made. Add keys later to enable the live integrations phase by phase (see `TODO.md`).

### Environment variables

All keys are documented in `.env.local.example`. The groups that flip the app out of mock mode:

- `ANTHROPIC_API_KEY` — required. Reasoning + vision (Claude Haiku 4.5 / Sonnet 4.6).
- `DEEPGRAM_API_KEY` — required for voice capture in F2 (`/api/transcribe`).
- `TAVILY_API_KEY` — optional. When present, the LLM gets a `tavily_search` tool for drug-recall and fresh-guidance lookups. When absent, the model proceeds without web context.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — Supabase project settings.
- `TELEGRAM_BOT_TOKEN` — @BotFather (needed for the bot scripts above).

Per-feature model overrides (defaults baked in code): `ANTHROPIC_MODEL_BRIEF`, `ANTHROPIC_MODEL_CONSULT`, `ANTHROPIC_MODEL_TRIAGE`.

Clinic identity is env-driven (no hardcoded clinic name): `NEXT_PUBLIC_CLINIC_*` (client) + `CLINIC_*` (server) — see `lib/env.ts` and `lib/clinic.ts`.

---

## Project layout

```
app/
  (app)/                # authed shell: dashboard, consult, follow-ups, analytics, passport
  api/                  # server routes (brief, consult, triage, transcribe, upload, followups, telegram/webhook, ...)
  layout.tsx, page.tsx  # marketing landing
components/
  app-shell/            # store, header, page header, escalation modal, toast, skeletons
  react-bits/           # animation primitives
  dogs.tsx              # three.js hero/companion
  landing-page.tsx
lib/
  data.ts               # mock data (display-only overlays once Supabase is live)
  types.ts              # domain types
  tokens.ts             # design tokens
  env.ts                # typed env reader + mock-mode helpers
  clinic.ts             # client-side clinic identity (NEXT_PUBLIC_CLINIC_*)
  llm.ts                # Anthropic Claude wrapper — tool-use loop + vision (per-feature model routing)
  glm.ts                # back-compat re-export of llm.ts
  glm-fixtures.ts       # triage/brief/consult fixtures (mock mode)
  prompts.ts            # Claude prompt templates with tool + vision guardrails
  storage.ts            # Supabase Storage upload helper (consult-photos / owner-photos) with base64 fallback
  tools/
    tavily.ts           # web-search tool def + executor + 7-day cache
    registry.ts         # per-feature tool registry (server / user / emit handling modes)
  telegram.ts           # grammY bot singleton + send helper + photo download
  telegram-handler.ts   # shared inbound handler (polling + webhook) — text + photo
  supabase.ts           # browser + server clients
scripts/
  start-bot.ts          # polling process (dev)
  send-test-followup.ts # seed a chat-linked followup + send 24h opener
  test-glm.ts           # Claude smoke (brief, consult, triage)
  test-tavily.ts        # Tavily live-search smoke
  test-realtime.ts      # realtime smoke
  test-tool-calling.ts  # 2-turn triage smoke
supabase/               # migrations + seed
agent/                  # LangGraph triage graph (Python sidecar — deferred to finals)
```

---

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build (type-checks + compiles)
npm run start   # serve production build
npm run lint    # eslint

npx tsx scripts/start-bot.ts                          # polling Telegram bot
npx tsx scripts/send-test-followup.ts <CHAT> [PET]    # seed + opener
npx tsx scripts/test-glm.ts                           # Claude (or fixture) smoke for brief/consult/triage
npx tsx scripts/test-tavily.ts                        # Tavily live-search smoke
npx tsx scripts/test-realtime.ts                      # Supabase Realtime smoke
npx tsx scripts/test-tool-calling.ts                  # multi-turn triage smoke
```

---

## Team

Built by **DA-Homies** for UMHackathon 2026.

## License

Hackathon submission — all rights reserved by the team.
