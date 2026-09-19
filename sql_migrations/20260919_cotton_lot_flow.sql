-- 20260919_cotton_lot_flow.sql
--
-- Adds yarn_type to lots, extends master_items with a yarn_scope so
-- chemicals/dyes can be filtered per yarn type, and creates a dedicated
-- Cotton lot-creation data model, separate from the existing Polyester
-- recipe_dyes/recipe_chemicals/process_steps tables (left untouched).
--
-- Design decision (confirmed with Ansh 2026-09-19): rather than retrofitting
-- Cotton/Nylon onto the polyester-shaped "base recipe + process steps"
-- model, each yarn type gets its own purpose-built creation flow and data
-- tables. This migration covers Cotton first; Nylon follows the same
-- pattern in a later migration once Cotton is verified end-to-end on
-- staging.
--
-- APPLIED SO FAR: staging schema only (2026-09-19), verified live. This
-- file targets `public` for when the Cotton flow is ready to ship to
-- production -- do not run it there until the corresponding app code
-- (CreateCottonLot page etc.) has been tested end-to-end on
-- shade-master-staging.
--
-- Cotton SOP reference (Recipes/Cotton-Dyeing-Process.md, confirmed with
-- Ansh + master, bifunctional reactive dyes only):
--   1. Scour + Bleach   -- wetting agent, emulsifier, caustic, peroxide + stabilizer, to 100C, 30 min
--   2. Neutralize       -- acetic acid + peroxide killer, to pH 6.5-7
--   3. Dye bath         -- Glauber's salt + leveling agent + dyes, ramp 0.5-1C/min to 60C, hold 30 min
--   4. Alkali - Soda    -- soda ash (injector), 20 min rotation, to pH 10.8
--   5. Alkali - Caustic -- caustic added on top, to pH 11, alkali hold 1hr total
--   6. Soaping          -- soaping agent, to 95C, hold 20 min
--   7. Fixing           -- fixer, pH 5-5.5, to 50C, hold 20 min

-- 1. yarn_type on lots
alter table public.lots
  add column if not exists yarn_type text not null default 'Polyester';

alter table public.lots
  drop constraint if exists lots_yarn_type_check,
  add constraint lots_yarn_type_check
    check (yarn_type in ('Polyester', 'Nylon', 'Cotton'));

comment on column public.lots.yarn_type is
  'Which dyeing process this lot follows. Polyester uses the existing recipe_dyes/recipe_chemicals/process_steps tables. Nylon and Cotton use their own dedicated *_lot_stages tables instead.';

-- 2. yarn_scope on master_items
alter table public.master_items
  add column if not exists yarn_scope text[] not null default array['Polyester'];

update public.master_items
  set yarn_scope = array['Polyester']
  where yarn_scope is null or yarn_scope = '{}';

comment on column public.master_items.yarn_scope is
  'Which yarn type(s) this dye/chemical applies to. A UI dropdown filters master_items by yarn_scope @> array[current lot''s yarn_type].';

create index if not exists idx_master_items_yarn_scope on public.master_items using gin (yarn_scope);

-- extend the existing Caustic Soda row rather than duplicating it -- check
-- first: `select name from public.master_items where lower(name) = 'caustic soda';`
-- should return exactly one row before running this update.
update public.master_items
  set yarn_scope = array['Polyester', 'Cotton']
  where lower(name) = 'caustic soda';

-- seed new cotton-only / shared chemicals. Replace the user_id below with
-- a real admin user id from your production user_roles before running.
insert into public.master_items (user_id, name, short_name, type, shade_family, company, unit, is_active, yarn_scope)
select '9f88a14e-74bd-4ccf-b36d-6f4c886db91c'::uuid, v.name, '', 'chemical', '', '', 'gpl', true, v.scope
from (values
  ('Wetting Agent',        array['Cotton']),
  ('Emulsifier',           array['Cotton']),
  ('Peroxide',             array['Cotton']),
  ('Peroxide Stabilizer',  array['Cotton']),
  ('Acetic Acid',          array['Cotton','Nylon']),
  ('Peroxide Killer',      array['Cotton']),
  ('Glauber''s Salt',      array['Cotton']),
  ('Leveling Agent',       array['Cotton','Nylon']),
  ('Soda Ash',             array['Cotton']),
  ('Soaping Agent',        array['Cotton','Nylon']),
  ('Fixer',                array['Cotton','Nylon'])
) as v(name, scope);

-- 3. Cotton lot data model
create table if not exists public.cotton_lot_stages (
  id uuid primary key default gen_random_uuid(),
  lot_no text not null references public.lots(lot_no) on delete cascade,
  stage_type text not null check (stage_type in (
    'Scour + Bleach', 'Neutralize', 'Dye Bath', 'Alkali - Soda',
    'Alkali - Caustic', 'Soaping', 'Fixing'
  )),
  stage_order int not null,
  target_ph numeric(4,2),
  target_temp_c numeric(5,2),
  ramp_rate_c_per_min numeric(5,2),
  hold_minutes int,
  notes text default '',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (lot_no, stage_type)
);

create table if not exists public.cotton_stage_chemicals (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.cotton_lot_stages(id) on delete cascade,
  chemical_id uuid not null references public.master_items(id),
  qty numeric(10,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cotton_stage_dyes (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.cotton_lot_stages(id) on delete cascade,
  dye_id uuid not null references public.master_items(id),
  percentage numeric(14,6) not null default 0,
  qty_grams numeric(10,3) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cotton_lot_stages enable row level security;
alter table public.cotton_stage_chemicals enable row level security;
alter table public.cotton_stage_dyes enable row level security;

drop policy if exists auth_full_access on public.cotton_lot_stages;
create policy auth_full_access on public.cotton_lot_stages for all to authenticated using (true) with check (true);

drop policy if exists auth_full_access on public.cotton_stage_chemicals;
create policy auth_full_access on public.cotton_stage_chemicals for all to authenticated using (true) with check (true);

drop policy if exists auth_full_access on public.cotton_stage_dyes;
create policy auth_full_access on public.cotton_stage_dyes for all to authenticated using (true) with check (true);

grant all on public.cotton_lot_stages, public.cotton_stage_chemicals, public.cotton_stage_dyes to anon, authenticated;

create index if not exists idx_cotton_lot_stages_lot_no on public.cotton_lot_stages(lot_no);
create index if not exists idx_cotton_stage_chemicals_stage_id on public.cotton_stage_chemicals(stage_id);
create index if not exists idx_cotton_stage_dyes_stage_id on public.cotton_stage_dyes(stage_id);
