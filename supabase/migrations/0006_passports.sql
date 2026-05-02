-- Pet passports — one row per patient. Generated when a doctor closes a
-- consult; rendered at /passport?pid=<patient_id> and shared with the
-- pet owner via Telegram. The full passport snapshot lives in `payload`
-- as JSONB so the schema doesn't need to change as the booklet evolves.
--
-- Safe to re-run.

create table if not exists passports (
  patient_id  uuid primary key references patients(id) on delete cascade,
  share_uuid  text not null,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists passports_share_uuid_idx on passports(share_uuid);

-- Touch updated_at on every change so callers can show "Updated <date>".
create or replace function passports_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists passports_updated_at on passports;
create trigger passports_updated_at
  before update on passports
  for each row execute function passports_set_updated_at();
