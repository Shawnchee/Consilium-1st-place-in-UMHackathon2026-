# Consilium

**AI Decision Copilot for Veterinary Clinics** — built for UMHackathon 2026.

> *Latin: medical council / advice.* The AI that thinks before the consult, acts after it.

Consilium gives solo vet clinics an AI copilot that briefs the doctor before every consult, captures and structures clinical notes during it, and autonomously follows up with owners after — escalating only the cases that genuinely need the doctor's eyes.

See [`PRD.md`](./PRD.md) for the full product spec and [`TODO.md`](./TODO.md) for the phased build plan.

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

## Stack

| Layer | Tool |
|---|---|
| App | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Motion / 3D | motion, three.js (r184) |
| Reasoning + vision | Anthropic Claude — Haiku 4.5 (brief), Sonnet 4.6 (consult, triage). Multimodal calls send wound photos / lab images alongside text. |
| LLM tools | Tavily web-search (drug recalls, fresh guidance) + 5 user-facing clarifying tools (request_photo, request_temperature, etc.) |
| Speech-to-text | Deepgram nova-3 — voice consult dictation via `/api/transcribe` |
| Agent framework | LangGraph (Python sidecar) — deferred to finals |
| Database | Supabase (Postgres + Realtime + tavily_cache) |
| Bot | grammY (Telegram) — polling in dev, webhook route ready for prod |
| Deploy | Vercel |

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

---

## Project layout

```
app/
  (app)/                # authed shell: dashboard, consult, follow-ups, analytics, passport
  api/                  # server routes (brief, consult, triage, transcribe, followups, telegram/webhook, ...)
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
npx tsx scripts/test-glm.ts                           # Claude (or fixture) smoke for brief/consult/triage
npx tsx scripts/test-tavily.ts                        # Tavily live-search smoke
npx tsx scripts/test-realtime.ts                      # Supabase Realtime smoke
npx tsx scripts/test-tool-calling.ts                  # multi-turn triage smoke
```

