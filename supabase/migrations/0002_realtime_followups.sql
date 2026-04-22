-- Enable Supabase Realtime on the followups table.
-- Applied via Supabase MCP (Phase M9). Kept here so a fresh project provision
-- can reach the same state via `supabase db push`.
--
-- `replica identity full` is already set in 0001_init.sql — that makes UPDATE
-- payloads carry the before+after row, which we need so the dashboard can
-- detect status transitions (e.g. pending -> escalate).

alter publication supabase_realtime add table followups;
