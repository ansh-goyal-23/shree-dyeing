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
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: only attaches triggers to two new tables.

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

-- Also do a one-time backfill of anything already seeded directly into
-- public by 20260928_client_rates_v2.sql before this trigger existed
-- (idempotent -- safe to re-run):
insert into staging.client_yarn_costs select * from public.client_yarn_costs on conflict (id) do nothing;
insert into staging.client_rate_tiers select * from public.client_rate_tiers on conflict (id) do nothing;

-- Verify with:
--   select event_object_table, trigger_name from information_schema.triggers
--   where trigger_name = 'trg_mirror_to_staging'
--   and event_object_table in ('client_yarn_costs', 'client_rate_tiers');
