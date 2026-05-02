-- Enable Supabase Realtime on the patients table.
-- The doctor's app subscribes to INSERT events so a freshly registered
-- intake from /receptionist surfaces a clickable arrival banner without
-- a manual refresh.

alter publication supabase_realtime add table patients;
