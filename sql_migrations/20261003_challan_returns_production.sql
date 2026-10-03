-- 20261003_challan_returns_production.sql
--
-- Promotes the Return Challan feature (staging-only since 1 Oct 2026, see
-- 20261001_challan_returns_staging.sql) to production. Verified working on
-- staging by Ansh before this ran. Mirrors the staging migration exactly,
-- but in `public` and referencing public's own clients/challans/challan_items,
-- plus registers the production -> staging live mirror trigger (one-way,
-- same pattern as every other production table -- see
-- 20260926_staging_live_mirror.sql and 20260928_client_rates_v2_mirror.sql).
--
-- NOTE: the `challan_return` value on store_transaction_type was already
-- added to the shared enum when the staging migration ran (the enum type
-- lives once in `public` and is shared by both schemas by OID) -- nothing
-- to do here for that part.
--
-- Run 2026-10-03 via Supabase MCP directly (apply_migration/execute_sql, in
-- small single-statement steps after repeated timeouts on larger combined
-- statements -- each step verified individually). SAFE / additive only,
-- IF NOT EXISTS throughout, re-runnable.

-- =====================================================================
-- 1. public.challan_returns (header)
-- =====================================================================
create table if not exists public.challan_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null,
  date date not null,
  client_id uuid references public.clients(id),
  notes text,
  prepared_by_name text,
  received_by_name text,
  received_by_contact_number text,
  created_at timestamptz not null default now(),
  created_by uuid
);

comment on table public.challan_returns is
  'Return Challan header -- yarn returned/rejected by a client against one or more of their past dispatch challans. Own number series (RET-1, RET-2, ...), not tied to the challan_number sequence.';

create index if not exists idx_challan_returns_client on public.challan_returns(client_id);
create index if not exists idx_challan_returns_date on public.challan_returns(date);

-- =====================================================================
-- 2. public.challan_return_items (lines)
-- =====================================================================
create table if not exists public.challan_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.challan_returns(id) on delete cascade,

  original_challan_id uuid references public.challans(id),
  original_challan_item_id uuid references public.challan_items(id),

  lot_no text,
  shade_number text,
  color_name text,
  denier text,
  ref_no text,
  lot_type text,
  packaging_type text,

  returned_gross_weight numeric not null default 0,
  returned_net_weight numeric not null default 0,
  returned_num_of_units integer not null default 0,
  returned_extra_cones integer not null default 0,

  rate numeric not null default 0,
  rate_tier_label text,
  paper_tube_surcharge numeric not null default 0,
  amount numeric not null default 0,

  reason text not null default 'Other',
  reason_note text,

  created_at timestamptz not null default now(),
  created_by uuid
);

comment on table public.challan_return_items is
  'Return Challan line items. Each line must reference the specific original challan_item it is returning against. Quantities are independently entered (partial returns supported), not derived from the original line.';

create index if not exists idx_challan_return_items_return on public.challan_return_items(return_id);
create index if not exists idx_challan_return_items_orig_challan on public.challan_return_items(original_challan_id);
create index if not exists idx_challan_return_items_orig_item on public.challan_return_items(original_challan_item_id);

-- =====================================================================
-- 3. RLS -- production's own read/write split convention (see
--    store_stock_transactions' store_txn_read / store_txn_write), rather
--    than staging's single blanket policy.
-- =====================================================================
alter table public.challan_returns enable row level security;
drop policy if exists challan_returns_read on public.challan_returns;
create policy challan_returns_read on public.challan_returns for select to authenticated using (true);
drop policy if exists challan_returns_write on public.challan_returns;
create policy challan_returns_write on public.challan_returns for all to authenticated using (true) with check (true);

alter table public.challan_return_items enable row level security;
drop policy if exists challan_return_items_read on public.challan_return_items;
create policy challan_return_items_read on public.challan_return_items for select to authenticated using (true);
drop policy if exists challan_return_items_write on public.challan_return_items;
create policy challan_return_items_write on public.challan_return_items for all to authenticated using (true) with check (true);

-- =====================================================================
-- 4. Attach to the live production -> staging mirror
-- =====================================================================
drop trigger if exists trg_mirror_to_staging on public.challan_returns;
create trigger trg_mirror_to_staging after insert or update or delete on public.challan_returns for each row execute function public.tg_mirror_to_staging();

drop trigger if exists trg_mirror_to_staging on public.challan_return_items;
create trigger trg_mirror_to_staging after insert or update or delete on public.challan_return_items for each row execute function public.tg_mirror_to_staging();

-- No backfill needed: unlike client_rates_v2 (where staging's rows were
-- independently seeded and had to be wiped/re-copied from public), staging's
-- challan_returns/challan_return_items are this feature's ORIGINAL data --
-- production starts empty and will mirror forward from here. Any test
-- returns Ansh already created on staging stay there untouched.

-- Verify with:
--   select table_schema, table_name from information_schema.tables
--   where table_name in ('challan_returns','challan_return_items');
--   select tgname, relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
--   where tgname = 'trg_mirror_to_staging' and relname in ('challan_returns','challan_return_items');
