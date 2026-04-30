-- ====================================================================
-- Delta-safe inventory system: yarn, dyes/chemicals, oil, finished goods
-- Run this SQL in Supabase SQL Editor.
-- ====================================================================

-- 1. Yarn inventory (auto-created per yarn_company + yarn_type combo)
create table if not exists public.yarn_inventory (
  id uuid primary key default gen_random_uuid(),
  yarn_company text not null,
  yarn_type    text not null,
  current_stock numeric(14,3) not null default 0,
  last_updated timestamptz not null default now(),
  unique (yarn_company, yarn_type)
);

-- 2. Material inventory (dyes & chemicals from master_items)
create table if not exists public.material_inventory (
  id uuid primary key default gen_random_uuid(),
  master_item_id uuid not null references public.master_items(id) on delete cascade,
  current_stock numeric(14,3) not null default 0,
  last_updated timestamptz not null default now(),
  unique (master_item_id)
);

-- 3. Oil inventory (single row)
create table if not exists public.oil_inventory (
  id uuid primary key default gen_random_uuid(),
  current_stock numeric(14,3) not null default 0,
  last_updated timestamptz not null default now()
);

insert into public.oil_inventory (current_stock)
select 0
where not exists (select 1 from public.oil_inventory);

-- 4. Finished goods stock per lot
create table if not exists public.finished_goods_stock (
  lot_no text primary key references public.lots(lot_no) on delete cascade,
  original_cones int not null default 0,
  original_net_weight numeric(14,3) not null default 0,
  remaining_cones int not null default 0,
  remaining_net_weight numeric(14,3) not null default 0,
  last_updated timestamptz not null default now()
);

-- 5. Unified ledger
create table if not exists public.inventory_transactions_v2 (
  id uuid primary key default gen_random_uuid(),
  inventory_kind text not null check (inventory_kind in ('yarn','material','oil','fg')),
  ref_key text not null,
  delta numeric(14,3) not null,
  source text not null,
  reference_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_invtxv2_kind_ref on public.inventory_transactions_v2(inventory_kind, ref_key);
create index if not exists idx_invtxv2_reference on public.inventory_transactions_v2(reference_id);

-- 6. Tracking columns on lots
alter table public.lots
  add column if not exists last_yarn_consumed numeric(14,3) not null default 0,
  add column if not exists last_dye_consumption jsonb not null default '{}'::jsonb,
  add column if not exists last_chemical_consumption jsonb not null default '{}'::jsonb,
  add column if not exists inventory_synced boolean not null default false;

-- 7. Tracking columns on challans
alter table public.challans
  add column if not exists last_oil_by_lot jsonb not null default '{}'::jsonb,
  add column if not exists last_fg_by_lot  jsonb not null default '{}'::jsonb,
  add column if not exists inventory_synced boolean not null default false;

-- Permissive RLS to match project convention
alter table public.yarn_inventory enable row level security;
alter table public.material_inventory enable row level security;
alter table public.oil_inventory enable row level security;
alter table public.finished_goods_stock enable row level security;
alter table public.inventory_transactions_v2 enable row level security;

do $$ begin
  create policy "yarn_inventory all" on public.yarn_inventory for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "material_inventory all" on public.material_inventory for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "oil_inventory all" on public.oil_inventory for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "finished_goods_stock all" on public.finished_goods_stock for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "inventory_transactions_v2 all" on public.inventory_transactions_v2 for all using (true) with check (true);
exception when duplicate_object then null; end $$;
