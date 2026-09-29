-- 20260929_raw_material_stock_mirror.sql
--
-- Adds public.raw_materials and public.raw_material_transactions to the
-- one-way live production-to-staging mirror (20260926_staging_live_mirror.sql),
-- reusing the same generic public.tg_mirror_to_staging() function.
--
-- Unlike the 20260928 client-rates mirror fix, a plain on-conflict(id)
-- backfill is correct here: neither table is pre-seeded with data
-- independently in both schemas (both start empty), so there's no
-- same-business-key-different-id collision to worry about -- ids will
-- always match across schemas from the first real insert onward.
--
-- Run this AFTER all three of:
--   20260926_staging_live_mirror.sql (creates the mirror function)
--   20260929_raw_material_stock.sql (creates the public tables)
--   20260929_raw_material_stock_staging.sql (creates the matching staging tables)
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: only attaches triggers to two new tables.

do $$
declare
  t text;
begin
  for t in select unnest(array['raw_materials', 'raw_material_transactions'])
  loop
    execute format('drop trigger if exists trg_mirror_to_staging on public.%I;', t);
    execute format(
      'create trigger trg_mirror_to_staging after insert or update or delete on public.%I for each row execute function public.tg_mirror_to_staging();',
      t
    );
  end loop;
end $$;

-- One-time backfill of anything already added to public before this
-- trigger existed (idempotent -- safe to re-run):
insert into staging.raw_materials select * from public.raw_materials on conflict (id) do nothing;
insert into staging.raw_material_transactions select * from public.raw_material_transactions on conflict (id) do nothing;

-- Verify with:
--   select event_object_table, trigger_name from information_schema.triggers
--   where trigger_name = 'trg_mirror_to_staging'
--   and event_object_table in ('raw_materials', 'raw_material_transactions');
