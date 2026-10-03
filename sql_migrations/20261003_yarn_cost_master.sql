-- 20261003_yarn_cost_master.sql  (public schema)
--
-- Admin Dashboard: raw grey-yarn cost per kg by denier, EFFECTIVE-DATED.
-- Yarn cost is revised once a month (effective the 1st) -- see
-- Clients/Client-List.md "Current Raw Yarn Cost" -- so each row says "from
-- this date, this denier costs X/kg"; a month's cost is the latest row with
-- effective_from <= that month's 1st. Used only by the admin dashboard's
-- monthly "revenue - raw yarn cost = overhead + profit" calculation.
--
-- ADMIN-ONLY at the database level (not just hidden in the UI): the cost
-- of yarn is non-public business data.
--
-- Seed: the 18 Sep 2026 "current yarn cost" table, effective 2026-09-01.
-- ASSUMPTION: earlier months have no row, so the dashboard falls back to the
-- earliest known cost for them and flags those months as "estimated".
-- SAFE / additive. Run in the Supabase SQL editor.

create table if not exists public.yarn_cost_master (
  id             uuid primary key default gen_random_uuid(),
  denier         text not null,
  effective_from date not null,
  cost_per_kg    numeric(10, 2) not null check (cost_per_kg >= 0),
  created_at     timestamptz not null default now(),
  unique (denier, effective_from)
);

grant select, insert, update, delete on public.yarn_cost_master to authenticated;
grant all on public.yarn_cost_master to service_role;

alter table public.yarn_cost_master enable row level security;

drop policy if exists "yarn_cost_master_admin_all" on public.yarn_cost_master;
create policy "yarn_cost_master_admin_all" on public.yarn_cost_master
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.yarn_cost_master (denier, effective_from, cost_per_kg) values
  ('150/0',    '2026-09-01', 160),
  ('150/tex',  '2026-09-01', 160),
  ('150/ROTO', '2026-09-01', 165),
  ('300/ROTO', '2026-09-01', 165)
on conflict (denier, effective_from) do nothing;
