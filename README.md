# Consilium

**AI Decision Copilot for Veterinary Clinics** — built for UMHackathon 2026.

> *Latin: medical council / advice.* The AI that thinks before the consult, acts after it.

Consilium gives solo vet clinics an AI copilot that briefs the doctor before every consult, captures and structures clinical notes during it, and autonomously follows up with owners after — escalating only the cases that genuinely need the doctor's eyes.

See [`PRD.md`](./PRD.md) for the full product spec and [`TODO.md`](./TODO.md) for the phased build plan.

---

## Stack

| Layer | Tool |
|---|---|
| App | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Motion / 3D | motion, three.js (r184) |
| AI | Z.AI GLM (mandatory) |
| Agent framework | LangGraph (Python sidecar) |
| Database | Supabase (Postgres + Realtime) |
| Bot | grammY (Telegram) inside Next.js API routes |
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

All keys are documented in `.env.local.example`. The three that flip the app out of mock mode:

- `ZAI_API_KEY` — Z.AI GLM console
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project settings
- `TELEGRAM_BOT_TOKEN` — @BotFather (only needed for Phase 8+)

---

## Project layout

```
app/
  (app)/                # authed shell: dashboard, consult, follow-ups, analytics, passport
  api/                  # server routes (added in Phase 1)
  layout.tsx, page.tsx  # marketing landing
components/
  app-shell/            # store, header, page header, escalation modal, toast
  react-bits/           # animation primitives
  dogs.tsx              # three.js hero/companion
  landing-page.tsx
lib/
  data.ts               # mock data (single source of truth until Supabase is wired)
  types.ts              # domain types
  tokens.ts             # design tokens
  env.ts                # typed env reader + mock-mode helpers
supabase/               # migrations + seed (Phase 3)
langgraph/              # triage graph (Phase 7)
```

---

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build (type-checks + compiles)
npm run start   # serve production build
npm run lint    # eslint
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
