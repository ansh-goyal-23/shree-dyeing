-- 20260924_drop_sampling_orders.sql
--
-- Removes the Sampling & Orders (Intake) module's data. The UI/code for this
-- module was deleted from the app on 2026-09-24 (to be rebuilt later).
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor on the
-- Shade Master project (uqgrgbqgcpqpdgemehdq). This is DESTRUCTIVE and cannot
-- be undone -- take a backup first (step 0).
--
-- Only these two tables belong to the module (both in schema `public`; the
-- `staging` schema never had them). `clients` is KEPT -- it is shared with
-- Dispatch, Client Rates and challans.

-- 0. BACKUP (optional but recommended): keep a copy inside the database, or
--    export both tables as CSV from Table Editor before running step 1.
-- create table public._bak_intake_entries as select * from public.intake_entries;
-- create table public._bak_intake_items   as select * from public.intake_items;

-- 1. Drop the tables (intake_items references intake_entries, so items first).
drop table if exists public.intake_items cascade;
drop table if exists public.intake_entries cascade;

-- 2. Delete the uploaded intake photos from the shared lot-photos bucket.
--    (Prefer the Storage UI if you want to eyeball them first.)
-- delete from storage.objects
--  where bucket_id = 'lot-photos'
--    and (name like 'intake-refs/%' or name like 'intake-samples/%');

-- 3. Note: Activity Center rows about intakes (module 'sampling', entity
--    'intake') are left in place as audit history; they now just have no link.

-- 4. Note: sql_migrations/20260603_editor_role.sql lists these two tables in
--    its loop. It guards with "if exists", so re-running it is still safe.
