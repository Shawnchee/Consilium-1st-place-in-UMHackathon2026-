-- Demo seed: insert the Milo cystotomy Schnauzer used in the live demo
-- and pre-populate his passport. The mock-mode "p1" Milo in lib/data.ts
-- only renders when Supabase is off; once Supabase is configured, the
-- dashboard pulls real rows from this table, so Milo needs to live here
-- too. UUID 11111111-...-000000000001 was the empty slot in the existing
-- demo-subset seed (002-009 were taken).
--
-- Idempotent: re-running upserts both the patient row and the passport
-- payload.

-- ─── 1. Milo the patient ────────────────────────────────────────────────────
-- created_at is forced to '2024-01-01' so Milo sorts to the TOP of the
-- dashboard schedule (the patients route orders by created_at ascending).
-- Without this, a freshly-inserted Milo would appear last and the demo
-- presenter would have to scroll to find him.
insert into patients (
  id, name, species, breed, age_years, sex,
  owner_name, owner_phone, owner_telegram, created_at
) values (
  '11111111-1111-1111-1111-000000000001',
  'Milo', 'Dog', 'Miniature Schnauzer', 8, 'Male (neutered)',
  'Aisyah Rahman', '+60 13 928 4717', null,
  '2024-01-01 00:00:00+00'
)
on conflict (id) do update set
  name = excluded.name,
  species = excluded.species,
  breed = excluded.breed,
  age_years = excluded.age_years,
  sex = excluded.sex,
  owner_name = excluded.owner_name,
  owner_phone = excluded.owner_phone,
  created_at = excluded.created_at;

-- ─── 2. Milo's passport (mirrors lib/passport-fixtures.ts MILO_DEMO_PAYLOAD)
insert into passports (patient_id, share_uuid, payload) values (
  '11111111-1111-1111-1111-000000000001',
  'milo-cystotomy-demo',
  jsonb_build_object(
    'patientId', '11111111-1111-1111-1111-000000000001',
    'shareUuid', 'milo-cystotomy-demo',
    'generatedAt', '01 Dec 2025',
    'identity', jsonb_build_object(
      'name', 'Milo',
      'species', 'Dog',
      'breed', 'Miniature Schnauzer',
      'age', '8yo',
      'sex', 'Male (neutered)',
      'owner', 'Aisyah Rahman',
      'ownerPhone', '+60 13 928 4717',
      'microchipId', '985112007419283'
    ),
    'vaccinations', jsonb_build_array(
      jsonb_build_object('name','DHPP','last','15 May 2025','next','May 2026','status','ok'),
      jsonb_build_object('name','Leptospirosis','last','15 May 2025','next','May 2026','status','ok'),
      jsonb_build_object('name','Rabies','last','20 Aug 2024','next','Aug 2025','status','overdue'),
      jsonb_build_object('name','Bordetella','last','10 Mar 2025','next','Mar 2026','status','due')
    ),
    'visits', jsonb_build_array(
      jsonb_build_object('date','01 Dec 2025','reason','Pre-cystotomy workup — haematuria + straining','outcome','X-ray confirmed cystoliths · cystotomy booked 02 Dec'),
      jsonb_build_object('date','24 Nov 2025','reason','External clinic referral note (owner-reported)','outcome','Amox-clav 7d + Urinary SO trial · symptoms persisted'),
      jsonb_build_object('date','15 May 2025','reason','Annual wellness exam','outcome','DHPP + Lepto boosters · bloods normal'),
      jsonb_build_object('date','10 Mar 2025','reason','Bordetella vaccination','outcome','No adverse reaction'),
      jsonb_build_object('date','20 Aug 2024','reason','Rabies vaccination + dental check','outcome','Healthy · grade 1 tartar noted')
    ),
    'activeMeds', jsonb_build_array(
      jsonb_build_object(
        'drug','Amoxicillin-clavulanate 250mg',
        'dose','12.5 mg/kg PO twice daily · with food',
        'progressLabel','Day 7 of 7',
        'progress', 1,
        'endsLabel','Ends 01 Dec 2025'
      )
    ),
    'lastDiagnosis', jsonb_build_object(
      'title','Bladder stones — surgery scheduled',
      'detail','Cystolithiasis with secondary urolithiasis. Two large cystoliths nearly filling the bladder, plus smaller uroliths scattered along the urethra. Cystotomy scheduled for 02 Dec 2025.',
      'bylineDate','01 Dec 2025',
      'bylineDoctor','Dr. Amirah'
    ),
    'notesForNextVet','Pre-cystotomy patient. Submit removed stones for analysis (likely struvite — failed medical dissolution despite 7-day antibiotic + Urinary SO trial at external clinic). Continue Urinary SO post-op pending lab result. Recheck UA at 2 + 6 weeks. Watch for urethral obstruction signs in the meantime — recurrent species/breed risk.'
  )
)
on conflict (patient_id) do update set
  share_uuid = excluded.share_uuid,
  payload = excluded.payload;

-- ─── 3. Clean up the Luna smoke-test row written during dev ─────────────────
-- Removes ONLY rows that have the test share_uuid markers. Safe to re-run.
delete from passports
where share_uuid in ('luna-smoke-test', 'test-luna');
