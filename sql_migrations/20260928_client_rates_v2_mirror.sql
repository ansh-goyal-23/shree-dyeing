-- 20260928_client_rates_v2_mirror.sql
--
-- Adds public.client_yarn_costs and public.client_rate_tiers to the
-- one-way live production-to-staging mirror (20260926_staging_live_mirror.sql),
-- reusing the same generic public.tg_mirror_to_staging() function -- no new
-- trigger function needed, this just attaches it to two more tables. Same
-- safety guarantee applies: a mirroring failure is caught and logged, never
-- breaks the production write.
--
-- Run this AFTER all three of:
--   20260926_staging_live_mirror.sql (creates the mirror function)
--   20260928_client_rates_v2.sql (creates public.client_yarn_costs / client_rate_tiers)
--   20260928_client_rates_v2_staging.sql (creates the matching staging tables)
--
-- FIXED 2026-09-28: the original version of this file backfilled with
-- `insert into staging.X select * from public.X on conflict (id) do
-- nothing`, assuming staging's rows already had the SAME id as public's for
-- the same client+yarn_type / client+tier. That assumption was wrong here:
-- unlike every other mirrored table (whose staging copy was first created by
-- literally copying public's rows, id included, in 20260926_staging_data_copy.sql),
-- client_yarn_costs/client_rate_tiers were seeded INDEPENDENTLY in
-- 20260928_client_rates_v2.sql (public) and 20260928_client_rates_v2_staging.sql
-- (staging) -- each insert calls gen_random_uuid() itself, so the same real
-- client+yarn_type ended up with two DIFFERENT row ids across the two
-- schemas. Backfilling by `on conflict (id)` therefore didn't recognize the
-- staging row as a duplicate and tried a real INSERT, which hit the table's
-- actual (client_id, yarn_type) / (client_id, sort_order) unique constraint
-- instead -- error 23505. The live-mirror TRIGGER would hit the exact same
-- problem on every future edit, since it also upserts by id.
--
-- Fix: make staging's copy of these two tables authoritative-from-public --
-- wipe them and re-copy directly from public (id included), exactly like
-- every other mirrored table's original backfill. After this, ids match
-- across both schemas and the ordinary on-conflict(id) trigger logic works
-- correctly for every future write, same as the other 18 tables.
--
-- SAFE / additive: only attaches triggers to two new tables and re-syncs
-- their staging copies from public (which already has the authoritative
-- seed data). Safe to re-run.

do $$
declare
  t text;
begin
  for t in select unnest(array['client_yarn_costs', 'client_rate_tiers'])
  loop
    execute format('drop trigger if exists trg_mirror_to_staging on public.%I;', t);
    execute format(
      'create trigger trg_mirror_to_staging after insert or update or delete on public.%I for each row execute function public.tg_mirror_to_staging();',
      t
    );
  end loop;
end $$;

-- One-time re-sync: staging's independently-seeded rows are replaced with
-- an exact, same-id copy of public's (the source of truth for these two
-- tables' seed data). Safe to re-run -- always converges to match public.
delete from staging.client_yarn_costs;
delete from staging.client_rate_tiers;
insert into staging.client_yarn_costs select * from public.client_yarn_costs;
insert into staging.client_rate_tiers select * from public.client_rate_tiers;

-- Verify with:
--   select event_object_table, trigger_name from information_schema.triggers
--   where trigger_name = 'trg_mirror_to_staging'
--   and event_object_table in ('client_yarn_costs', 'client_rate_tiers');
--   select count(*) from staging.client_yarn_costs;  -- should be 12 (3 clients x 4 yarn types)
--   select count(*) from staging.client_rate_tiers;  -- should be 14 (6 + 4 + 4)
