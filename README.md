# Consilium

**AI Decision Copilot for Veterinary Clinics** — built for UMHackathon 2026.

> *Latin: medical council / advice.* The AI that thinks before the consult, acts after it.

Consilium gives solo vet clinics an AI copilot that briefs the doctor before every consult, captures and structures clinical notes during it, and autonomously follows up with owners after — escalating only the cases that genuinely need the doctor's eyes.

See [`PRD.md`](./PRD.md) for the full product spec and [`TODO.md`](./TODO.md) for the phased build plan.

---

## Try the Telegram bot

The owner-facing follow-up channel is live on Telegram as [`@consilium_vet_bot`](https://t.me/consilium_vet_bot). A real grammY bot talks to the (currently mock) GLM triage agent and writes decisions back to Supabase, which the dashboard picks up over Realtime.

### One-time setup

1. Copy `.env.local.example` → `.env.local` and fill in:
   - `TELEGRAM_BOT_TOKEN` (from @BotFather)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. `npm install`
3. Apply migrations + seed (via Supabase MCP or psql): `supabase/migrations/*.sql` then `supabase/seed.sql`.

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

Watch the terminal running `start-bot.ts` — you'll see colour-coded boxes for owner inbound, agent reasoning, tool call or decision, and the outbound reply. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) in parallel to see the escalation card appear live.

---

## Stack

| Layer | Tool |
|---|---|
| App | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Motion / 3D | motion, three.js (r184) |
| AI | Z.AI GLM (mocked today — real-client swap tracked in `TODO.md` Backlog) |
| Agent framework | LangGraph (Python sidecar) — deferred to finals |
| Database | Supabase (Postgres + Realtime) |
| Bot | grammY (Telegram) — polling in dev, webhook route ready for prod |
| Deploy | Vercel |

---

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in keys as you get them
npm run dev                        # http://localhost:3000
```

The app boots in **mock mode** when Z.AI / Supabase keys are missing — every page renders from `lib/data.ts` and no network calls are made. Add keys later to enable the live integrations phase by phase (see `TODO.md`).

### Environment variables

All keys are documented in `.env.local.example`. The three groups that flip the app out of mock mode:

- `ZAI_API_KEY` — Z.AI GLM console (optional today; swap-in tracked as Phase 5-real)
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — Supabase project settings
- `TELEGRAM_BOT_TOKEN` — @BotFather (needed for the bot scripts above)

---

## Project layout

```
app/
  (app)/                # authed shell: dashboard, consult, follow-ups, analytics, passport
  api/                  # server routes (brief, consult, triage, followups, telegram/webhook, ...)
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
  glm.ts                # GLM client (mock today; real-client body swap)
  glm-fixtures.ts       # triage/brief/consult fixtures
  prompts.ts            # prompt templates
  telegram.ts           # grammY bot singleton + send helper
  telegram-handler.ts   # shared inbound handler (polling + webhook)
  supabase.ts           # browser + server clients
scripts/
  start-bot.ts          # polling process (dev)
  send-test-followup.ts # seed a chat-linked followup + send 24h opener
  test-glm.ts           # GLM smoke
  test-realtime.ts      # realtime smoke
  test-tool-calling.ts  # 2-turn triage smoke
supabase/               # migrations + seed
langgraph/              # triage graph (deferred — see Backlog)
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
npx tsx scripts/test-glm.ts                           # GLM fixture smoke
npx tsx scripts/test-realtime.ts                      # Supabase Realtime smoke
npx tsx scripts/test-tool-calling.ts                  # multi-turn triage smoke
```

---

## Team

| Person | Role |
|---|---|
| Brandon | AI Engineer — GLM integration, prompts, LangGraph |
| Zi Qian | Software Engineer — Next.js, API routes, Supabase, Telegram, deploy |
| Yu Han | Data Analyst — seed data, validation scenarios |
| Shawn | Frontend + PM — UI, escalation modal, demo |
| Harrison | Domain + QA — billing matrix, clinical QA |
