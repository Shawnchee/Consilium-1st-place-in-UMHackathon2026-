# Supabase setup

Schema + seed for Consilium. Files only — nothing is deployed automatically.
Follow these steps once to bring a project online, then Phase 4 will flip the
API routes off `MOCK_MODE`.

## 1. Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Region: closest to you (e.g. `ap-southeast-1` / Singapore).
3. Save the database password somewhere durable — you'll need it for the
   connection string.

## 2. Copy credentials into `.env.local`

From **Project Settings → API**:

| Supabase field | `.env.local` key |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key (secret) | `SUPABASE_SERVICE_ROLE_KEY` |

From **Project Settings → Database → Connection string → URI**:

| Supabase field | `.env.local` key |
|---|---|
| URI (password filled in) | `SUPABASE_DB_URL` |

The service-role key is server-only — never expose it to the browser, never
commit it. `lib/supabase.ts` enforces this by only reading it from
`getSupabaseServer()`.

## 3. Run the migration

**Option A — SQL editor (easiest for hackathon):**
1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `migrations/0001_init.sql`, run.
3. Paste the contents of `seed.sql`, run.

**Option B — psql:**
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

**Option C — Supabase MCP (if configured):**
Use `mcp__supabase__apply_migration` with the file's contents.

## 4. Enable Realtime on `followups`

Needed for Phase 9 (escalation cards appear without refresh). The migration
already sets `REPLICA IDENTITY FULL`; you still need to toggle publication in
the dashboard:

1. **Database → Replication** → find `followups` → enable.
2. Verify by running an `UPDATE` in the SQL editor and watching the realtime
   inspector.

## 5. Verify

```sql
select count(*) from patients;   -- 9
select count(*) from visits;     -- 9
select count(*) from followups;  -- 5
select count(*) from corrections; -- 0
```

## Files

- `migrations/0001_init.sql` — tables, indexes, `REPLICA IDENTITY FULL` on
  `followups`. Idempotent (`create table if not exists`).
- `seed.sql` — 9 patients, 9 visits, 5 followups mirroring `lib/data.ts`.
  Truncates on re-run, so running twice is safe.

## Re-seeding

`seed.sql` starts with a `truncate ... cascade`, so re-running wipes all
rows in those four tables and re-inserts the fixtures. Safe until we start
holding production data (post-demo).
