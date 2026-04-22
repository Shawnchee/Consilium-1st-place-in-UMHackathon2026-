-- Consilium initial schema (PRD §10).
-- Safe to re-run: guarded with IF NOT EXISTS where possible.

create extension if not exists "pgcrypto";

-- ─── patients ────────────────────────────────────────────────────────────────
create table if not exists patients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  species         text,
  breed           text,
  age_years       int,
  sex             text,
  owner_name      text,
  owner_phone     text,
  owner_telegram  text,
  created_at      timestamptz not null default now()
);

-- ─── visits ──────────────────────────────────────────────────────────────────
create table if not exists visits (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id) on delete cascade,
  visit_date      date not null default current_date,
  raw_notes       text,
  soap_note       text,
  prescription    jsonb,
  billing_items   jsonb,
  todo_list       jsonb,
  followup_date   date,
  created_at      timestamptz not null default now()
);

create index if not exists visits_patient_id_idx on visits(patient_id);
create index if not exists visits_visit_date_idx on visits(visit_date desc);

-- ─── followups ───────────────────────────────────────────────────────────────
create table if not exists followups (
  id               uuid primary key default gen_random_uuid(),
  visit_id         uuid not null references visits(id) on delete cascade,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  status           text not null default 'pending',
  -- status: pending | sent | replied | all_clear | monitor | escalate | resolved
  owner_message    text,
  glm_decision     text,
  confidence       double precision,
  differentials    jsonb,
  draft_response   text,
  recommended_action text,
  doctor_approved  boolean not null default false,
  telegram_chat_id text,
  created_at       timestamptz not null default now()
);

create index if not exists followups_visit_id_idx on followups(visit_id);
create index if not exists followups_status_idx on followups(status);

-- Realtime requires full row in change payloads.
alter table followups replica identity full;

-- ─── corrections ─────────────────────────────────────────────────────────────
create table if not exists corrections (
  id                uuid primary key default gen_random_uuid(),
  visit_id          uuid references visits(id) on delete set null,
  followup_id       uuid references followups(id) on delete set null,
  feature           text not null, -- 'billing' | 'triage' | 'prescription' | 'brief'
  glm_output        text,
  rejection_reason  text,
  doctor_correction text,
  approved          boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists corrections_feature_idx on corrections(feature, created_at desc);
