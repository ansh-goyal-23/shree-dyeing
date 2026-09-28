-- 20260928_client_rates_v2_staging.sql
--
-- Staging-schema companion to 20260928_client_rates_v2.sql. Same new
-- tiered client-rates system + paper-tube cone surcharge, fully
-- re-qualified to the `staging` schema so it can be built/tested
-- immediately on the staging site. See 20260928_client_rates_v2.sql for
-- full design-decision commentary -- not repeated here to avoid drift
-- between the two copies.
--
-- Depends on 20260926_staging_schema_full.sql already having been run
-- (needs staging.clients, staging.challan_items to exist).
--
-- Once 20260926_staging_live_mirror.sql has ALSO been run, run
-- 20260928_client_rates_v2_mirror.sql after this file (and after
-- 20260928_client_rates_v2.sql) to keep future production edits to these
-- new tables flowing into staging automatically, same as every other
-- mirrored table.
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: only adds new columns (nullable or defaulted) and new
-- tables; touches no existing data or behaviour of flat-rate clients.

-- ---------- clients: rate mode + optional cone-surcharge config ----------

alter table staging.clients
  add column if not exists rate_mode text not null default 'flat',
  add column if not exists paper_tube_baseline_kg_per_cone numeric(10, 3),
  add column if not exists paper_tube_extra_cone_surcharge numeric(10, 2);

alter table staging.clients
  drop constraint if exists clients_rate_mode_check,
  add constraint clients_rate_mode_check check (rate_mode in ('flat', 'tiered'));

-- ---------- client_yarn_costs: raw yarn cost per (client, yarn type) ----------

create table if not exists staging.client_yarn_costs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references staging.clients(id) on delete cascade,
  yarn_type    text not null,
  rate_per_kg  numeric(10, 2) not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, yarn_type)
);

create index if not exists idx_client_yarn_costs_client on staging.client_yarn_costs (client_id);

drop trigger if exists trg_client_yarn_costs_updated_at on staging.client_yarn_costs;
create trigger trg_client_yarn_costs_updated_at
  before update on staging.client_yarn_costs
  for each row execute function public.tg_store_set_updated_at();

grant select, insert, update, delete on staging.client_yarn_costs to authenticated;
grant all on staging.client_yarn_costs to service_role;

alter table staging.client_yarn_costs enable row level security;

drop policy if exists "client_yarn_costs_read" on staging.client_yarn_costs;
create policy "client_yarn_costs_read" on staging.client_yarn_costs
  for select to authenticated using (true);

drop policy if exists "client_yarn_costs_write" on staging.client_yarn_costs;
create policy "client_yarn_costs_write" on staging.client_yarn_costs
  for all to authenticated using (true) with check (true);

-- ---------- client_rate_tiers: quantity-based overhead bands, per client ----------

create table if not exists staging.client_rate_tiers (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references staging.clients(id) on delete cascade,
  min_qty        numeric(18, 4) not null,
  max_qty        numeric(18, 4),        -- null = "and above" (top, open-ended band)
  overhead_rate  numeric(10, 2) not null,
  label          text not null,          -- e.g. "1-5 kg", "250+ kg" (shown in the challan dropdown)
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (client_id, sort_order)
);

create index if not exists idx_client_rate_tiers_client on staging.client_rate_tiers (client_id, sort_order);

drop trigger if exists trg_client_rate_tiers_updated_at on staging.client_rate_tiers;
create trigger trg_client_rate_tiers_updated_at
  before update on staging.client_rate_tiers
  for each row execute function public.tg_store_set_updated_at();

grant select, insert, update, delete on staging.client_rate_tiers to authenticated;
grant all on staging.client_rate_tiers to service_role;

alter table staging.client_rate_tiers enable row level security;

drop policy if exists "client_rate_tiers_read" on staging.client_rate_tiers;
create policy "client_rate_tiers_read" on staging.client_rate_tiers
  for select to authenticated using (true);

drop policy if exists "client_rate_tiers_write" on staging.client_rate_tiers;
create policy "client_rate_tiers_write" on staging.client_rate_tiers
  for all to authenticated using (true) with check (true);

-- ---------- challan_items: snapshot columns for tiered-rate lines ----------

alter table staging.challan_items
  add column if not exists yarn_cost numeric(10, 2),
  add column if not exists overhead_rate numeric(10, 2),
  add column if not exists rate_tier_label text,
  add column if not exists paper_tube_surcharge numeric(10, 2) not null default 0;

-- ---------- Seed: real tiered-rate agreements already in force ----------
-- (see Clients/Client-List.md for the source numbers). Idempotent: safe to
-- re-run. NOTE: 150/tex is currently seeded at the same cost as 150/0 --
-- flagged in Client-List.md as a placeholder pending separate confirmation.

update staging.clients set rate_mode = 'tiered'
where trim(client_name) ilike 'Himanshi Narrow Fabrics';

update staging.clients
set paper_tube_baseline_kg_per_cone = 1, paper_tube_extra_cone_surcharge = 8
where trim(client_name) ilike 'Himanshi Narrow Fabrics';

update staging.clients set rate_mode = 'tiered'
where trim(client_name) ilike 'Sriman Weaving';

update staging.clients set rate_mode = 'tiered'
where trim(client_name) ilike 'Guru Sharan Creations';

-- Yarn costs
insert into staging.client_yarn_costs (client_id, yarn_type, rate_per_kg)
select id, v.yarn_type, v.rate_per_kg
from staging.clients,
  lateral (values
    ('150/0', 160), ('150/tex', 160), ('150/ROTO', 165), ('300/ROTO', 165)
  ) as v(yarn_type, rate_per_kg)
where trim(client_name) ilike 'Himanshi Narrow Fabrics'
on conflict (client_id, yarn_type) do update set rate_per_kg = excluded.rate_per_kg;

insert into staging.client_yarn_costs (client_id, yarn_type, rate_per_kg)
select id, v.yarn_type, v.rate_per_kg
from staging.clients,
  lateral (values
    ('150/0', 160), ('150/tex', 160), ('150/ROTO', 165), ('300/ROTO', 165)
  ) as v(yarn_type, rate_per_kg)
where trim(client_name) ilike 'Sriman Weaving'
on conflict (client_id, yarn_type) do update set rate_per_kg = excluded.rate_per_kg;

insert into staging.client_yarn_costs (client_id, yarn_type, rate_per_kg)
select id, v.yarn_type, v.rate_per_kg
from staging.clients,
  lateral (values
    ('150/0', 160), ('150/tex', 160), ('150/ROTO', 165), ('300/ROTO', 165)
  ) as v(yarn_type, rate_per_kg)
where trim(client_name) ilike 'Guru Sharan Creations'
on conflict (client_id, yarn_type) do update set rate_per_kg = excluded.rate_per_kg;

-- Rate tiers
insert into staging.client_rate_tiers (client_id, min_qty, max_qty, overhead_rate, label, sort_order)
select id, v.min_qty, v.max_qty, v.overhead_rate, v.label, v.sort_order
from staging.clients,
  lateral (values
    (1::numeric, 5::numeric, 150::numeric, '1-5 kg', 1),
    (6, 20, 100, '6-20 kg', 2),
    (21, 49, 95, '21-49 kg', 3),
    (50, 99, 90, '50-99 kg', 4),
    (100, 249, 85, '100-249 kg', 5),
    (250, null, 80, '250+ kg', 6)
  ) as v(min_qty, max_qty, overhead_rate, label, sort_order)
where trim(client_name) ilike 'Himanshi Narrow Fabrics'
on conflict (client_id, sort_order) do update set
  min_qty = excluded.min_qty, max_qty = excluded.max_qty,
  overhead_rate = excluded.overhead_rate, label = excluded.label;

insert into staging.client_rate_tiers (client_id, min_qty, max_qty, overhead_rate, label, sort_order)
select id, v.min_qty, v.max_qty, v.overhead_rate, v.label, v.sort_order
from staging.clients,
  lateral (values
    (1::numeric, 5::numeric, 150::numeric, '1-5 kg', 1),
    (6, 49, 100, '6-49 kg', 2),
    (50, 99, 90, '50-99 kg', 3),
    (100, null, 80, '100+ kg', 4)
  ) as v(min_qty, max_qty, overhead_rate, label, sort_order)
where trim(client_name) ilike 'Sriman Weaving'
on conflict (client_id, sort_order) do update set
  min_qty = excluded.min_qty, max_qty = excluded.max_qty,
  overhead_rate = excluded.overhead_rate, label = excluded.label;

insert into staging.client_rate_tiers (client_id, min_qty, max_qty, overhead_rate, label, sort_order)
select id, v.min_qty, v.max_qty, v.overhead_rate, v.label, v.sort_order
from staging.clients,
  lateral (values
    (1::numeric, 5::numeric, 150::numeric, '1-5 kg', 1),
    (6, 49, 110, '6-49 kg', 2),
    (50, 99, 100, '50-99 kg', 3),
    (100, null, 90, '100+ kg', 4)
  ) as v(min_qty, max_qty, overhead_rate, label, sort_order)
where trim(client_name) ilike 'Guru Sharan Creations'
on conflict (client_id, sort_order) do update set
  min_qty = excluded.min_qty, max_qty = excluded.max_qty,
  overhead_rate = excluded.overhead_rate, label = excluded.label;
