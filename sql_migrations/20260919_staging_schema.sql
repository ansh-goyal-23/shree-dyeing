-- 20260919_staging_schema.sql
--
-- Creates an isolated `staging` schema, structurally mirroring the tables
-- involved in lot/recipe/process-step creation, for testing the upcoming
-- Nylon/Cotton lot-creation work without touching real production data
-- in `public`. Both schemas live in the same Shade Master Supabase project
-- (no separate paid project/branch) but are fully separate table sets.
--
-- Scope: only the tables CreateLot / RecipeEditor / ProcessStepForm /
-- ReferenceRecipePanel actually read or write. Store, Dispatch, Expenses,
-- Sampling etc. are NOT cloned here -- staging is scoped to shade/recipe
-- work for now. Extend this file (or add a new one) if staging needs to
-- exercise more of the app later.
--
-- IMPORTANT: run this once against the Shade Master project (uqgrgbqgcpqpdgemehdq).
-- It is safe to re-run (IF NOT EXISTS guards), but will not pick up later
-- structural changes to public tables automatically -- re-diff manually if
-- the public schema changes shape after this runs.

create schema if not exists staging;

create table if not exists staging.lots (like public.lots including all);
create table if not exists staging.master_items (like public.master_items including all);
create table if not exists staging.process_steps (like public.process_steps including all);
create table if not exists staging.recipe_dyes (like public.recipe_dyes including all);
create table if not exists staging.recipe_chemicals (like public.recipe_chemicals including all);
create table if not exists staging.step_dyes (like public.step_dyes including all);
create table if not exists staging.step_chemicals (like public.step_chemicals including all);
create table if not exists staging.lot_versions (like public.lot_versions including all);
create table if not exists staging.lot_photos (like public.lot_photos including all);
create table if not exists staging.post_dye_actions (like public.post_dye_actions including all);
create table if not exists staging.post_dye_action_dyes (like public.post_dye_action_dyes including all);
create table if not exists staging.post_dye_action_chemicals (like public.post_dye_action_chemicals including all);

-- LIKE ... INCLUDING ALL copies CHECK constraints and indexes/PKs, but
-- foreign keys are NOT included by INCLUDING ALL in Postgres. Recreate the
-- FK relationships that matter for referential integrity within staging.
alter table staging.recipe_dyes
  drop constraint if exists recipe_dyes_lot_no_fkey,
  add constraint recipe_dyes_lot_no_fkey
    foreign key (lot_no) references staging.lots(lot_no) on delete cascade;

alter table staging.recipe_chemicals
  drop constraint if exists recipe_chemicals_lot_no_fkey,
  add constraint recipe_chemicals_lot_no_fkey
    foreign key (lot_no) references staging.lots(lot_no) on delete cascade;

alter table staging.process_steps
  drop constraint if exists process_steps_lot_no_fkey,
  add constraint process_steps_lot_no_fkey
    foreign key (lot_no) references staging.lots(lot_no) on delete cascade;

alter table staging.step_dyes
  drop constraint if exists step_dyes_step_id_fkey,
  add constraint step_dyes_step_id_fkey
    foreign key (step_id) references staging.process_steps(id) on delete cascade;

alter table staging.step_chemicals
  drop constraint if exists step_chemicals_step_id_fkey,
  add constraint step_chemicals_step_id_fkey
    foreign key (step_id) references staging.process_steps(id) on delete cascade;

alter table staging.post_dye_actions
  drop constraint if exists post_dye_actions_lot_no_fkey,
  add constraint post_dye_actions_lot_no_fkey
    foreign key (lot_no) references staging.lots(lot_no) on delete cascade;

alter table staging.post_dye_action_dyes
  drop constraint if exists post_dye_action_dyes_action_id_fkey,
  add constraint post_dye_action_dyes_action_id_fkey
    foreign key (action_id) references staging.post_dye_actions(id) on delete cascade;

alter table staging.post_dye_action_chemicals
  drop constraint if exists post_dye_action_chemicals_action_id_fkey,
  add constraint post_dye_action_chemicals_action_id_fkey
    foreign key (action_id) references staging.post_dye_actions(id) on delete cascade;

alter table staging.lot_photos
  drop constraint if exists lot_photos_lot_no_fkey,
  add constraint lot_photos_lot_no_fkey
    foreign key (lot_no) references staging.lots(lot_no) on delete cascade;

alter table staging.lot_versions
  drop constraint if exists lot_versions_lot_no_fkey,
  add constraint lot_versions_lot_no_fkey
    foreign key (lot_no) references staging.lots(lot_no) on delete cascade;

-- RLS: mirror the effective production pattern (any authenticated user has
-- full read/write; the app enforces role restrictions in the UI, not the DB
-- -- documented and intentional, see Software/Application-Overview.md).
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'lots','master_items','process_steps','recipe_dyes','recipe_chemicals',
    'step_dyes','step_chemicals','lot_versions','lot_photos',
    'post_dye_actions','post_dye_action_dyes','post_dye_action_chemicals'
  ])
  loop
    execute format('alter table staging.%I enable row level security;', t);
    execute format(
      'drop policy if exists staging_auth_full_access on staging.%I;', t
    );
    execute format(
      'create policy staging_auth_full_access on staging.%I for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;

-- Grants: the anon/authenticated roles need USAGE on the schema itself,
-- since schema access isn't implied by table grants.
grant usage on schema staging to anon, authenticated;
grant all on all tables in schema staging to anon, authenticated;
alter default privileges in schema staging grant all on tables to anon, authenticated;

-- Done. Verify with:
--   select table_name from information_schema.tables where table_schema = 'staging';
