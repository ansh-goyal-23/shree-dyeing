-- ====================================================================
-- Inventory change logs (replaces the approval popup workflow).
-- One row per inventory line affected, captured at apply time.
-- Admin-only read; any authenticated user can insert.
-- ====================================================================

create table if not exists public.inventory_change_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  user_email text,
  action text not null,                 -- 'Lot Save' | 'Lot Edit' | 'Lot Delete' | 'Dispatch' | 'Dispatch Edit' | 'Dispatch Delete'
  reference_type text not null,         -- 'lot' | 'challan'
  reference_id text not null,           -- lot_no or challan id
  section text not null,                -- 'Yarn' | 'Dyes' | 'Chemicals' | 'Finished Goods' | 'Oil'
  item_label text not null,
  unit text,
  prev_stock text,
  change text,
  new_stock text,
  warn boolean not null default false
);

create index if not exists idx_inv_change_logs_created_at on public.inventory_change_logs(created_at desc);
create index if not exists idx_inv_change_logs_user on public.inventory_change_logs(user_id);
create index if not exists idx_inv_change_logs_ref on public.inventory_change_logs(reference_type, reference_id);

grant select, insert on public.inventory_change_logs to authenticated;
grant all on public.inventory_change_logs to service_role;

alter table public.inventory_change_logs enable row level security;

do $$ begin
  create policy "inv_logs admin select" on public.inventory_change_logs
    for select to authenticated using (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inv_logs authenticated insert" on public.inventory_change_logs
    for insert to authenticated with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;
