-- Multi-turn triage state on followups (Phase M10a).
-- `conversation` is an ordered jsonb array of turns:
--   { role: "owner", text, ts }
--   { role: "bot_tool", tool, args, reasoning, ownerPrompt, ts }
--   { role: "bot_decision", decision, confidence, differentials, reply, ts }
-- `tool_call_count` caps info-gathering turns (PRD §F3 — max 1 per flow).

alter table followups
  add column if not exists conversation jsonb not null default '[]'::jsonb,
  add column if not exists tool_call_count int not null default 0;
