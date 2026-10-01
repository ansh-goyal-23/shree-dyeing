-- 20261001_challan_returns_staging.sql
--
-- New feature: Return Challan. A client sometimes rejects/returns some of
-- the dyed yarn sent on a past challan. This records that return against
-- the exact original challan line(s), restocks the yarn back into Store,
-- and feeds into the existing per-client Excel export (as a negative-qty
-- row) so the accountant's periodic bill-making totals net out correctly.
-- Decided with Ansh (1 Oct 2026):
--   - returns restock Store (new ledger transaction type)
--   - a return item must link to a specific original challan_item (not
--     just the challan as a whole) -- tightest reconciliation
--   - billing stays informational/Excel-only: no change to the original
--     challan's amount_received / Paid-Partially Paid-Unpaid math
--   - its own numbered, printable document (RET-1, RET-2, ...)
--   - its own page in the app, like EDY Challans got split out
--   - STAGING FIRST: this migration only touches `staging` (new tables)
--     plus one additive, backward-compatible enum value in `public`
--     (explained below) -- production's own challan_returns tables will
--     ship in a separate migration once this is verified on staging.
--
-- SAFE / additive only. Run now in the Supabase SQL editor (Shade Master,
-- project uqgrgbqgcpqpdgemehdq). Re-runnable (IF NOT EXISTS throughout).

-- =====================================================================
-- 1. New store-ledger transaction type: `challan_return`
-- =====================================================================
-- store_transaction_type is a single, schema-owned enum type that lives
-- in `public` (see 20260926_staging_schema_full.sql's note on ENUM types
-- -- staging's store_stock_transactions.transaction_type column refers to
-- this exact same public type by OID, not a staging-local copy). Adding a
-- new value is purely additive: it does not change any existing row, and
-- production code will never insert 'challan_return' until the feature
-- ships there. This is the one piece of this migration that technically
-- touches `public`, but only as an inert enum label -- nothing reads or
-- writes it until the app code (staging only, for now) does.
alter type public.store_transaction_type add value if not exists 'challan_return';

-- =====================================================================
-- 2. staging.challan_returns (header)
-- =====================================================================
create table if not exists staging.challan_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null,
  date date not null,
  client_id uuid references staging.clients(id),
  notes text,
  prepared_by_name text,
  received_by_name text,
  received_by_contact_number text,
  created_at timestamptz not null default now(),
  created_by uuid
);

comment on table staging.challan_returns is
  'Return Challan header -- yarn returned/rejected by a client against one or more of their past dispatch challans. Own number series (RET-1, RET-2, ...), not tied to the challan_number sequence.';

create index if not exists idx_challan_returns_client on staging.challan_returns(client_id);
create index if not exists idx_challan_returns_date on staging.challan_returns(date);

-- =====================================================================
-- 3. staging.challan_return_items (lines)
-- =====================================================================
create table if not exists staging.challan_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references staging.challan_returns(id) on delete cascade,

  -- Required link to the exact original line being returned (decided:
  -- tightest reconciliation, not just the challan as a whole).
  original_challan_id uuid references staging.challans(id),
  original_challan_item_id uuid references staging.challan_items(id),

  -- Copied from the original line at return time for display/printing --
  -- same snapshot-immutability principle as challan_items itself.
  lot_no text,
  shade_number text,
  color_name text,
  denier text,
  ref_no text,
  lot_type text,
  packaging_type text,

  -- What's actually coming back -- independently entered, can be less
  -- than the original line's quantities (partial returns, e.g. 2 of 10
  -- cones rejected).
  returned_gross_weight numeric not null default 0,
  returned_net_weight numeric not null default 0,
  returned_num_of_units integer not null default 0,
  returned_extra_cones integer not null default 0,

  -- Rate/tier copied from the original line (it was already fixed there);
  -- amount/paper_tube_surcharge computed the same way a normal challan
  -- line is, then snapshotted.
  rate numeric not null default 0,
  rate_tier_label text,
  paper_tube_surcharge numeric not null default 0,
  amount numeric not null default 0,

  reason text not null default 'Other',
  reason_note text,

  created_at timestamptz not null default now(),
  created_by uuid
);

comment on table staging.challan_return_items is
  'Return Challan line items. Each line must reference the specific original challan_item it is returning against. Quantities are independently entered (partial returns supported), not derived from the original line.';

create index if not exists idx_challan_return_items_return on staging.challan_return_items(return_id);
create index if not exists idx_challan_return_items_orig_challan on staging.challan_return_items(original_challan_id);
create index if not exists idx_challan_return_items_orig_item on staging.challan_return_items(original_challan_item_id);

-- =====================================================================
-- 4. RLS -- same blanket "any authenticated user" policy as every other
--    staging table (permissive at the DB level, restrictions are in the
--    UI -- see Software/Application-Overview.md).
-- =====================================================================
alter table staging.challan_returns enable row level security;
drop policy if exists staging_auth_full_access on staging.challan_returns;
create policy staging_auth_full_access on staging.challan_returns for all to authenticated using (true) with check (true);

alter table staging.challan_return_items enable row level security;
drop policy if exists staging_auth_full_access on staging.challan_return_items;
create policy staging_auth_full_access on staging.challan_return_items for all to authenticated using (true) with check (true);

-- No mirror-trigger registration needed: these tables don't exist in
-- `public` yet (that's the point of staging-first), so there is nothing
-- for public -> staging mirroring to pick up. When this ships to
-- production, the equivalent public tables + mirror trigger registration
-- will be a separate, explicitly-reviewed migration.
