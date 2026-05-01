-- 0005_storage_buckets.sql
-- Pre-create the two public buckets the app uploads images to.
--   consult-photos  → vet-uploaded media during F2 consult capture
--   owner-photos    → owner-sent photos forwarded by the Telegram bot
--
-- Both are public so Claude vision can fetch the URL directly and the
-- dashboard can render thumbnails without signed-URL plumbing. Service-role
-- key (SUPABASE_SERVICE_ROLE_KEY) handles the writes; anon clients only read.
--
-- Without this migration, lib/storage.ts silently falls back to inline
-- base64 — vision still works, you just lose the audit trail.

insert into storage.buckets (id, name, public)
values
  ('consult-photos', 'consult-photos', true),
  ('owner-photos',   'owner-photos',   true)
on conflict (id) do nothing;
