-- Consilium minimal seed. Mirrors lib/data.ts so the frontend looks identical
-- once MOCK_MODE flips off. Yu Han will expand this to 150 patients in Phase 12.
--
-- Idempotent: truncate + insert. Safe to re-run during Supabase bring-up.

begin;

truncate table corrections, followups, visits, patients restart identity cascade;

-- ─── patients (5 dashboard + 4 follow-up only = 9) ───────────────────────────
insert into patients (id, name, species, breed, age_years, sex, owner_name, owner_phone, owner_telegram) values
  ('11111111-1111-1111-1111-000000000001', 'Milo',    'Dog', 'Golden Retriever',     4,  'Male (neutered)',   'Aisyah Rahman',       '+60 12 345 6789', null),
  ('11111111-1111-1111-1111-000000000002', 'Luna',    'Cat', 'British Shorthair',    2,  'Female (spayed)',   'Daniel Tan',          '+60 16 778 2310', null),
  ('11111111-1111-1111-1111-000000000003', 'Rex',     'Dog', 'German Shepherd',      7,  'Male (intact)',     'Priya Subramaniam',   '+60 19 234 5566', null),
  ('11111111-1111-1111-1111-000000000004', 'Mochi',   'Dog', 'Shih Tzu',             9,  'Female (spayed)',   'Lim Wei Ming',        '+60 17 889 0022', null),
  ('11111111-1111-1111-1111-000000000005', 'Bella',   'Cat', 'Domestic Shorthair',   12, 'Female (spayed)',   'Hafiz Ismail',        '+60 13 556 9988', null),
  -- Follow-up-only patients (referenced by f2..f5 in lib/data.ts):
  ('11111111-1111-1111-1111-000000000006', 'Coco',    'Dog', 'Mixed',                5,  'Male (neutered)',   'Sarah Goh',           null,              null),
  ('11111111-1111-1111-1111-000000000007', 'Biscuit', 'Dog', 'Mixed',                3,  'Male (neutered)',   'James Lee',           null,              null),
  ('11111111-1111-1111-1111-000000000008', 'Pepper',  'Cat', 'Domestic Shorthair',   6,  'Female (spayed)',   'Nadia Osman',         null,              null),
  ('11111111-1111-1111-1111-000000000009', 'Tofu',    'Dog', 'Poodle',               1,  'Male (intact)',     'Marcus Chen',         null,              null);

-- ─── visits ──────────────────────────────────────────────────────────────────
-- One visit per patient so every follow-up has a parent. Notes are short
-- placeholders; Phase 5+ will replace raw_notes with real consult content.
insert into visits (id, patient_id, visit_date, raw_notes, soap_note) values
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000001', current_date,       'Post-spay day 0. Uncomplicated. Sent home on Meloxicam.', null),
  ('22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000002', current_date,       'First visit. Inappetence 2d. Intake exam pending.',        null),
  ('22222222-2222-2222-2222-000000000003', '11111111-1111-1111-1111-000000000003', current_date - 3,   'Right stifle TPLO post-op day 0.',                         null),
  ('22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-000000000004', current_date - 18,  'Pyoderma L flank. Cephalexin 7d.',                         null),
  ('22222222-2222-2222-2222-000000000005', '11111111-1111-1111-1111-000000000005', current_date - 68,  'Senior panel. BUN 32. k/d diet started.',                  null),
  ('22222222-2222-2222-2222-000000000006', '11111111-1111-1111-1111-000000000006', current_date - 1,   'Dental scale + 2 extractions. Uncomplicated.',             null),
  ('22222222-2222-2222-2222-000000000007', '11111111-1111-1111-1111-000000000007', current_date - 3,   'Acute GI upset. Bland diet + metronidazole 5d.',           null),
  ('22222222-2222-2222-2222-000000000008', '11111111-1111-1111-1111-000000000008', current_date - 5,   'Otitis externa bilateral. Ear drops 7d.',                  null),
  ('22222222-2222-2222-2222-000000000009', '11111111-1111-1111-1111-000000000009', current_date - 2,   'DHPP booster. No reaction.',                               null);

-- ─── followups (5, one per "follow-up" patient) ──────────────────────────────
insert into followups (
  id, visit_id, scheduled_at, sent_at, status,
  owner_message, glm_decision, confidence, differentials, draft_response, recommended_action, doctor_approved
) values
  (
    '33333333-3333-3333-3333-000000000001',
    '22222222-2222-2222-2222-000000000001',
    now() - interval '2 days', now() - interval '12 minutes', 'escalate',
    'She''s been lying there and won''t touch her food since morning. The wound looks a bit red too.',
    'escalate', 0.80,
    '[{"cause":"Normal post-anaesthesia recovery","probability":0.65,"tone":"green"},{"cause":"Early wound infection","probability":0.35,"tone":"red"}]'::jsonb,
    'Hi Aisyah, thank you for the update. Based on what you''re describing, we''d like to see Milo today for a quick wound check. Before you come in, could you send a clear photo of the incision and, if you have a thermometer, take her temperature? We can fit you in at 2:30pm. — PawsClinic KL',
    'Bring in today for wound check — photo + temp reading first if possible',
    false
  ),
  (
    '33333333-3333-3333-3333-000000000002',
    '22222222-2222-2222-2222-000000000006',
    now() - interval '1 day', now() - interval '38 minutes', 'escalate',
    'He''s drooling a lot of blood and I can see his gum is really swollen on the left. Is this normal? He won''t let me near his mouth.',
    'escalate', 0.90,
    '[{"cause":"Extraction socket breakdown / infection","probability":0.72,"tone":"red"},{"cause":"Normal post-op oozing","probability":0.28,"tone":"green"}]'::jsonb,
    'Hi Sarah, that level of bleeding and swelling on Day 1 isn''t something we want to wait on. Please bring Coco in today — we can see him at 3:15pm. Do not give any food or water in the 2 hours before coming. — PawsClinic KL',
    'Same-day recheck — likely needs socket re-examination under sedation',
    false
  ),
  (
    '33333333-3333-3333-3333-000000000003',
    '22222222-2222-2222-2222-000000000007',
    now() - interval '3 days', now() - interval '2 hours', 'monitor',
    'Stool is firmer today, still a bit soft. Appetite back to normal. Drinking well.',
    'monitor', 0.78, null, null,
    'Continue bland diet 2 more days, transition slowly to normal',
    true
  ),
  (
    '33333333-3333-3333-3333-000000000004',
    '22222222-2222-2222-2222-000000000008',
    now() - interval '5 days', now() - interval '4 hours', 'monitor',
    'Scratching less but still a bit. No smell anymore. Finished 5 of 7 days of drops.',
    'monitor', 0.72, null, null,
    'Complete full course, recheck in 10 days',
    true
  ),
  (
    '33333333-3333-3333-3333-000000000005',
    '22222222-2222-2222-2222-000000000009',
    now() - interval '2 days', now() - interval '6 hours', 'clear',
    'All good! Back to his crazy self, eating like a horse. Thanks doc!',
    'clear', 0.95, null, null,
    'Auto-reply sent, case closed',
    true
  );

commit;
