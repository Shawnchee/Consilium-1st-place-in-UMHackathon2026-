-- 0004_tavily_cache.sql
-- 7-day cache for Tavily search results so the consult/triage paths don't
-- pay for the same query twice. lib/tools/tavily.ts reads/writes this table
-- best-effort: missing table = pure live mode (no caching), no errors.

create table if not exists tavily_cache (
  id          uuid primary key default gen_random_uuid(),
  query_norm  text not null,
  query_raw   text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists tavily_cache_query_norm_created_idx
  on tavily_cache (query_norm, created_at desc);
