-- Add a free-form "what to probe today" field to patients so the
-- receptionist can hand the doctor a starting prompt at intake (e.g.
-- "Owner reports straining to urinate, blood in urine x 2 days").
-- Surfaces on the doctor's arrival banner and feeds the consult brief.

alter table patients
  add column if not exists reason_for_visit text;
