-- 20260926_staging_schema_full.sql
--
-- Extends the isolated `staging` schema (sql_migrations/20260919_staging_schema.sql)
-- to cover the rest of the app -- Clients & Rates, Dispatch, Expenses, Store,
-- Activity Center and User Management -- so the whole staging site works,
-- not just Shade Management / Lot Detail.
--
-- WHY THIS WAS NEEDED: the staging build points every query at the `staging`
-- schema (see src/integrations/supabase/client.ts), but 20260919 only cloned
-- the lot/recipe/process-step tables. Every other tab (Dispatch, Store,
-- Expenses, Client Rates, Users, Activity) queries tables that simply did
-- not exist under `staging`, so those pages failed to load while Lot Detail
-- (which only touches the cloned tables) kept working.
--
-- SAFE: this migration only CREATEs objects inside the `staging` schema. It
-- never touches `public` and does not require a backup. It is written to be
-- re-runnable (IF NOT EXISTS / OR REPLACE / DROP CONSTRAINT IF EXISTS
-- throughout, matching the style of 20260919_staging_schema.sql).
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor on the
-- Shade Master project (uqgrgbqgcpqpdgemehdq).
--
-- OUT OF SCOPE (already handled elsewhere / not needed):
--   - Cotton lot tables (cotton_lot_stages/cotton_stage_chemicals/
--     cotton_stage_dyes) and the yarn_type/yarn_scope columns -- per the
--     comment in 20260919_cotton_lot_flow.sql these were already applied
--     directly to the staging schema by hand on 2026-09-19 and verified
--     live; this file does not touch them.
--   - Sampling & Orders (intake_entries/intake_items) -- the module was
--     removed from the app on 2026-09-24 (see Software/Release-Status.md)
--     and is being rebuilt from scratch, so it is intentionally not cloned.
--   - Custom ENUM types (store_item_category, store_transaction_type,
--     app_role, etc.) -- these are schema-owned TYPE objects in `public`,
--     but a column in `staging` can reference a `public.*` type directly;
--     Postgres resolves the type by OID, not by search_path, so there is
--     no need (or way) to "clone" them, and LIKE ... INCLUDING ALL carries
--     the correct type reference automatically.

-- =====================================================================
-- 1. CLIENTS & CLIENT RATES
-- =====================================================================

create table if not exists staging.clients (like public.clients including all);
create table if not exists staging.client_rate_master (like public.client_rate_master including all);

-- =====================================================================
-- 2. DISPATCH (CHALLANS)
-- =====================================================================

create table if not exists staging.challans (like public.challans including all);
create table if not exists staging.challan_items (like public.challan_items including all);

alter table staging.challans
  drop constraint if exists challans_client_id_fkey,
  add constraint challans_client_id_fkey
    foreign key (client_id) references staging.clients(id) on delete restrict;

alter table staging.challan_items
  drop constraint if exists challan_items_challan_id_fkey,
  add constraint challan_items_challan_id_fkey
    foreign key (challan_id) references staging.challans(id) on delete cascade;

-- =====================================================================
-- 3. EXPENSES
-- =====================================================================

create table if not exists staging.suppliers (like public.suppliers including all);
create table if not exists staging.company_master (like public.company_master including all);
create table if not exists staging.expense_categories (like public.expense_categories including all);
create table if not exists staging.expense_items (like public.expense_items including all);
create table if not exists staging.expenses (like public.expenses including all);
create table if not exists staging.expense_line_items (like public.expense_line_items including all);
create table if not exists staging.expense_documents (like public.expense_documents including all);

alter table staging.expenses
  drop constraint if exists expenses_category_id_fkey,
  add constraint expenses_category_id_fkey
    foreign key (category_id) references staging.expense_categories(id) on delete set null;

alter table staging.expenses
  drop constraint if exists expenses_supplier_id_fkey,
  add constraint expenses_supplier_id_fkey
    foreign key (supplier_id) references staging.suppliers(id) on delete set null;

alter table staging.expense_items
  drop constraint if exists expense_items_category_id_fkey,
  add constraint expense_items_category_id_fkey
    foreign key (category_id) references staging.expense_categories(id) on delete set null;

alter table staging.expense_line_items
  drop constraint if exists expense_line_items_expense_id_fkey,
  add constraint expense_line_items_expense_id_fkey
    foreign key (expense_id) references staging.expenses(id) on delete cascade;

alter table staging.expense_documents
  drop constraint if exists expense_documents_expense_id_fkey,
  add constraint expense_documents_expense_id_fkey
    foreign key (expense_id) references staging.expenses(id) on delete cascade;

-- company_id appears on expense_items for certain; guarded because it is
-- unconfirmed whether `expenses` itself also carries a company_id column.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'staging' and table_name = 'expense_items' and column_name = 'company_id')
  then
    alter table staging.expense_items
      drop constraint if exists expense_items_company_id_fkey,
      add constraint expense_items_company_id_fkey
        foreign key (company_id) references staging.company_master(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'staging' and table_name = 'expenses' and column_name = 'company_id')
  then
    alter table staging.expenses
      drop constraint if exists expenses_company_id_fkey,
      add constraint expenses_company_id_fkey
        foreign key (company_id) references staging.company_master(id) on delete set null;
  end if;
end $$;

-- =====================================================================
-- 4. STORE
-- =====================================================================

create table if not exists staging.store_racks (like public.store_racks including all);
create table if not exists staging.store_items (like public.store_items including all);
create table if not exists staging.store_stock_transactions (like public.store_stock_transactions including all);
create table if not exists staging.store_assets (like public.store_assets including all);
create table if not exists staging.store_asset_movements (like public.store_asset_movements including all);
create table if not exists staging.store_verification_sessions (like public.store_verification_sessions including all);
create table if not exists staging.store_verification_lines (like public.store_verification_lines including all);
create table if not exists staging.store_yarn_receipts (like public.store_yarn_receipts including all);

alter table staging.store_items
  drop constraint if exists store_items_default_rack_fkey,
  add constraint store_items_default_rack_fkey
    foreign key (default_rack) references staging.store_racks(id) on delete set null;

alter table staging.store_stock_transactions
  drop constraint if exists store_stock_transactions_item_id_fkey,
  add constraint store_stock_transactions_item_id_fkey
    foreign key (item_id) references staging.store_items(id) on delete restrict;

alter table staging.store_stock_transactions
  drop constraint if exists store_stock_transactions_rack_id_fkey,
  add constraint store_stock_transactions_rack_id_fkey
    foreign key (rack_id) references staging.store_racks(id) on delete set null;

alter table staging.store_assets
  drop constraint if exists store_assets_item_id_fkey,
  add constraint store_assets_item_id_fkey
    foreign key (item_id) references staging.store_items(id) on delete restrict;

alter table staging.store_assets
  drop constraint if exists store_assets_rack_id_fkey,
  add constraint store_assets_rack_id_fkey
    foreign key (rack_id) references staging.store_racks(id) on delete set null;

alter table staging.store_asset_movements
  drop constraint if exists store_asset_movements_asset_id_fkey,
  add constraint store_asset_movements_asset_id_fkey
    foreign key (asset_id) references staging.store_assets(id) on delete cascade;

alter table staging.store_asset_movements
  drop constraint if exists store_asset_movements_rack_id_fkey,
  add constraint store_asset_movements_rack_id_fkey
    foreign key (rack_id) references staging.store_racks(id) on delete set null;

alter table staging.store_asset_movements
  drop constraint if exists store_asset_movements_transaction_id_fkey,
  add constraint store_asset_movements_transaction_id_fkey
    foreign key (transaction_id) references staging.store_stock_transactions(id) on delete set null;

alter table staging.store_verification_lines
  drop constraint if exists store_verification_lines_session_id_fkey,
  add constraint store_verification_lines_session_id_fkey
    foreign key (session_id) references staging.store_verification_sessions(id) on delete cascade;

alter table staging.store_verification_lines
  drop constraint if exists store_verification_lines_item_id_fkey,
  add constraint store_verification_lines_item_id_fkey
    foreign key (item_id) references staging.store_items(id) on delete restrict;

alter table staging.store_verification_lines
  drop constraint if exists store_verification_lines_rack_id_fkey,
  add constraint store_verification_lines_rack_id_fkey
    foreign key (rack_id) references staging.store_racks(id) on delete set null;

alter table staging.store_verification_lines
  drop constraint if exists store_verification_lines_adjustment_txn_id_fkey,
  add constraint store_verification_lines_adjustment_txn_id_fkey
    foreign key (adjustment_txn_id) references staging.store_stock_transactions(id) on delete set null;

alter table staging.store_yarn_receipts
  drop constraint if exists store_yarn_receipts_rack_id_fkey,
  add constraint store_yarn_receipts_rack_id_fkey
    foreign key (rack_id) references staging.store_racks(id) on delete set null;

alter table staging.store_yarn_receipts
  drop constraint if exists store_yarn_receipts_item_id_fkey,
  add constraint store_yarn_receipts_item_id_fkey
    foreign key (item_id) references staging.store_items(id) on delete set null;

-- ---- Store views (LIKE cannot copy views -- recreated manually, same
-- ---- shape as the public originals, but scoped to staging tables) ----

create or replace view staging.store_current_stock as
select
    i.id                 as item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit,
    i.is_asset,
    t.rack_id,
    r.rack_code,
    r.rack_name,
    coalesce(sum(t.quantity), 0)::numeric(18,4) as current_quantity
from staging.store_items i
left join staging.store_stock_transactions t on t.item_id = i.id
left join staging.store_racks r on r.id = t.rack_id
where i.is_active = true
group by i.id, i.item_code, i.item_name, i.category, i.sub_category,
         i.unit, i.is_asset, t.rack_id, r.rack_code, r.rack_name;

create or replace view staging.store_current_stock_by_item as
select
    i.id                                as item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit,
    i.is_asset,
    i.default_rack                      as default_rack_id,
    dr.rack_code                        as default_rack_code,
    dr.rack_name                        as default_rack_name,
    coalesce(sum(t.quantity), 0)::numeric(18,4)  as current_quantity,
    max(t.transaction_date)             as last_transaction_date,
    max(t.created_at)                   as last_transaction_at
from staging.store_items i
left join staging.store_stock_transactions t on t.item_id = i.id
left join staging.store_racks dr             on dr.id = i.default_rack
where i.is_active = true
group by i.id, i.item_code, i.item_name, i.category, i.sub_category,
         i.unit, i.is_asset, i.default_rack, dr.rack_code, dr.rack_name;

create or replace view staging.store_stock_ledger as
select
    t.id,
    t.transaction_number,
    t.transaction_date,
    t.transaction_type,
    t.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit                                                          as item_unit,
    i.is_asset,
    t.quantity,
    greatest(t.quantity, 0)::numeric(18,4)                          as qty_in,
    greatest(-t.quantity, 0)::numeric(18,4)                         as qty_out,
    t.unit,
    t.rack_id,
    r.rack_code,
    r.rack_name,
    t.reference_type,
    t.reference_number,
    t.person,
    t.supplier,
    t.department,
    t.remarks,
    t.created_by,
    t.created_at,
    sum(t.quantity) over (
        partition by t.item_id
        order by t.transaction_date, t.created_at, t.id
        rows between unbounded preceding and current row
    )::numeric(18,4) as running_balance
from staging.store_stock_transactions t
join staging.store_items i on i.id = t.item_id
left join staging.store_racks r on r.id = t.rack_id;

create or replace view staging.store_assets_view as
select
    a.id,
    a.asset_id,
    a.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    a.current_holder,
    a.department,
    a.rack_id,
    r.rack_code,
    r.rack_name,
    a.purchase_date,
    a.condition,
    a.status,
    a.remarks,
    a.created_at,
    a.updated_at
from staging.store_assets a
join staging.store_items i on i.id = a.item_id
left join staging.store_racks r on r.id = a.rack_id;

create or replace view staging.store_verification_lines_view as
select
    l.id,
    l.session_id,
    l.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    l.unit,
    l.rack_id,
    r.rack_code,
    r.rack_name,
    l.system_quantity,
    l.physical_quantity,
    case when l.physical_quantity is null then null
         else (l.physical_quantity - l.system_quantity)::numeric(18,4)
    end as difference,
    l.remarks,
    l.adjustment_txn_id,
    l.created_at,
    l.updated_at
from staging.store_verification_lines l
join staging.store_items i on i.id = l.item_id
left join staging.store_racks r on r.id = l.rack_id;

-- Note: lot_status is looked up from staging.lots (already cloned in
-- 20260919_staging_schema.sql), so a Finished Goods receipt's status
-- reflects the SAME staging lot data Shade Management is testing against.
create or replace view staging.store_yarn_receipt_stock as
select
    yr.id                as receipt_id,
    yr.receipt_number,
    yr.receipt_date,
    yr.source,
    yr.lot_no,
    yr.shade,
    yr.shade_number,
    yr.yarn_type,
    yr.client,
    yr.supplier,
    yr.challan_number,
    yr.challan_pdf_url,
    yr.cone_count,
    yr.received_weight,
    yr.rate,
    yr.amount,
    yr.rack_id,
    r.rack_code,
    r.rack_name,
    yr.item_id,
    i.item_code,
    i.unit,
    coalesce(sum(t.quantity), 0)::numeric(18,4) as current_balance,
    l.status             as lot_status
from staging.store_yarn_receipts yr
left join staging.store_items i on i.id = yr.item_id
left join staging.store_racks r on r.id = yr.rack_id
left join staging.store_stock_transactions t on t.item_id = yr.item_id
left join staging.lots l on l.lot_no = yr.lot_no and yr.source = 'finished_goods'
group by yr.id, yr.receipt_number, yr.receipt_date, yr.source, yr.lot_no,
         yr.shade, yr.shade_number, yr.yarn_type, yr.client, yr.supplier,
         yr.challan_number, yr.challan_pdf_url, yr.cone_count,
         yr.received_weight, yr.rate, yr.amount,
         yr.rack_id, r.rack_code, r.rack_name,
         yr.item_id, i.item_code, i.unit, l.status;

-- ---- Store number-generator RPCs ----
-- The app calls these via supabase.rpc('next_store_txn_number') etc.
-- PostgREST resolves an rpc call within whichever schema the client is
-- configured for, so a staging build cannot reach the public.* versions
-- even though it has the right search_path internally -- these need their
-- own objects living in `staging`. Each one uses its OWN staging-local
-- sequence (not public's), so testing on staging never advances a
-- production sequence counter.

create sequence if not exists staging.store_txn_seq start 1;
create sequence if not exists staging.store_inward_seq start 1;
create sequence if not exists staging.store_issue_seq start 1;
create sequence if not exists staging.store_fg_seq start 1;
create sequence if not exists staging.store_edy_seq start 1;
create sequence if not exists staging.store_asset_seq start 1;
create sequence if not exists staging.store_verification_seq start 1;

create or replace function staging.next_store_txn_number()
returns text language sql volatile security definer set search_path = staging
as $$ select 'STX-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('staging.store_txn_seq')::text, 5, '0'); $$;

create or replace function staging.next_store_inward_number()
returns text language sql volatile security definer set search_path = staging
as $$ select 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('staging.store_inward_seq')::text, 5, '0'); $$;

create or replace function staging.next_store_issue_number()
returns text language sql volatile security definer set search_path = staging
as $$ select 'ISS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('staging.store_issue_seq')::text, 5, '0'); $$;

create or replace function staging.next_store_fg_number()
returns text language sql volatile security definer set search_path = staging
as $$ select 'FG-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('staging.store_fg_seq')::text, 5, '0'); $$;

create or replace function staging.next_store_edy_number()
returns text language sql volatile security definer set search_path = staging
as $$ select 'EDY-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('staging.store_edy_seq')::text, 5, '0'); $$;

create or replace function staging.next_store_asset_id()
returns text language sql volatile security definer set search_path = staging
as $$ select 'AST-' || lpad(nextval('staging.store_asset_seq')::text, 5, '0'); $$;

create or replace function staging.next_store_verification_number()
returns text language sql volatile security definer set search_path = staging
as $$ select 'SVN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('staging.store_verification_seq')::text, 4, '0'); $$;

grant execute on function
  staging.next_store_txn_number(), staging.next_store_inward_number(),
  staging.next_store_issue_number(), staging.next_store_fg_number(),
  staging.next_store_edy_number(), staging.next_store_asset_id(),
  staging.next_store_verification_number()
  to anon, authenticated;

-- store_items / store_assets updated_at triggers: public.tg_store_set_updated_at()
-- is pure logic (just sets NEW.updated_at = now()), does not reference any
-- table, so it is safe to call directly from a staging-table trigger --
-- unlike the number-generator RPCs above, triggers are resolved by OID at
-- DDL time, not looked up per-schema by PostgREST, so no staging copy of
-- this one function is needed.
drop trigger if exists trg_store_items_updated_at on staging.store_items;
create trigger trg_store_items_updated_at
    before update on staging.store_items
    for each row execute function public.tg_store_set_updated_at();

drop trigger if exists trg_store_racks_updated_at on staging.store_racks;
create trigger trg_store_racks_updated_at
    before update on staging.store_racks
    for each row execute function public.tg_store_set_updated_at();

drop trigger if exists trg_store_assets_updated_at on staging.store_assets;
create trigger trg_store_assets_updated_at
    before update on staging.store_assets
    for each row execute function public.tg_store_set_updated_at();

drop trigger if exists trg_store_yarn_receipts_updated_at on staging.store_yarn_receipts;
create trigger trg_store_yarn_receipts_updated_at
    before update on staging.store_yarn_receipts
    for each row execute function public.tg_store_set_updated_at();

drop trigger if exists trg_svs_updated_at on staging.store_verification_sessions;
create trigger trg_svs_updated_at
    before update on staging.store_verification_sessions
    for each row execute function public.tg_store_set_updated_at();

drop trigger if exists trg_svl_updated_at on staging.store_verification_lines;
create trigger trg_svl_updated_at
    before update on staging.store_verification_lines
    for each row execute function public.tg_store_set_updated_at();

-- =====================================================================
-- 5. ROLES (staging-local) + ACTIVITY CENTER + USER MANAGEMENT
-- =====================================================================
-- staging.user_roles already exists (20260919_staging_schema.sql, seeded
-- 2026-09-19 per that file's own follow-up note). These functions read
-- THAT table, not public.user_roles, so an admin/editor/viewer assignment
-- on staging is independent of production, matching the isolation intent
-- documented there.

create or replace function staging.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = staging
as $$
  select exists (
    select 1 from staging.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function staging.get_my_role()
returns public.app_role
language sql stable security definer set search_path = staging
as $$
  select role from staging.user_roles where user_id = auth.uid()
  order by case role::text
    when 'admin'  then 0
    when 'editor' then 1
    else 2
  end
  limit 1;
$$;

create or replace function staging.list_users_with_roles()
returns table (user_id uuid, email text, created_at timestamptz, role text)
language plpgsql stable security definer set search_path = staging, auth
as $$
begin
  if not staging.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can list users';
  end if;
  return query
    select u.id, u.email::text, u.created_at,
      coalesce(
        (select r.role::text from staging.user_roles r
          where r.user_id = u.id
          order by case r.role::text
            when 'admin'  then 0
            when 'editor' then 1
            else 2
          end
          limit 1),
        'viewer'
      )
    from auth.users u
    order by u.created_at desc;
end;
$$;

create or replace function staging.set_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql security definer set search_path = staging
as $$
begin
  if not staging.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can set roles';
  end if;
  delete from staging.user_roles where user_id = _user_id;
  insert into staging.user_roles (user_id, role) values (_user_id, _role);
end;
$$;

create or replace function staging.claim_first_admin()
returns void
language plpgsql security definer set search_path = staging
as $$
begin
  if exists (select 1 from staging.user_roles where role = 'admin') then
    raise exception 'An admin already exists';
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into staging.user_roles (user_id, role) values (auth.uid(), 'admin')
    on conflict (user_id, role) do nothing;
end;
$$;

grant execute on function
  staging.has_role(uuid, public.app_role), staging.get_my_role(),
  staging.list_users_with_roles(), staging.set_user_role(uuid, public.app_role),
  staging.claim_first_admin()
  to anon, authenticated;

create table if not exists staging.business_events (like public.business_events including all);
create table if not exists staging.user_activity (like public.user_activity including all);
create table if not exists staging.system_events (like public.system_events including all);
create table if not exists staging.inventory_change_logs (like public.inventory_change_logs including all);

-- =====================================================================
-- 6. ROW-LEVEL SECURITY
-- =====================================================================
-- Same pattern as 20260919_staging_schema.sql for ordinary tables/views:
-- any authenticated user has full read/write (the app enforces role
-- restrictions in the UI, not the DB -- see Software/Application-Overview.md).
-- Activity Center tables are the one exception in PRODUCTION TOO: they are
-- admin-gated at the RLS level, so staging mirrors that exactly using
-- staging.has_role() instead of the open policy.

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'clients','client_rate_master',
    'challans','challan_items',
    'suppliers','company_master','expense_categories','expense_items',
    'expenses','expense_line_items','expense_documents',
    'store_racks','store_items','store_stock_transactions',
    'store_assets','store_asset_movements',
    'store_verification_sessions','store_verification_lines',
    'store_yarn_receipts',
    'user_roles'
  ])
  loop
    execute format('alter table staging.%I enable row level security;', t);
    execute format('drop policy if exists staging_auth_full_access on staging.%I;', t);
    execute format('create policy staging_auth_full_access on staging.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Activity Center: admin-only read, any authenticated insert (mirrors public).
alter table staging.business_events enable row level security;
drop policy if exists staging_admin_read on staging.business_events;
create policy staging_admin_read on staging.business_events
  for select to authenticated using (staging.has_role(auth.uid(), 'admin'));
drop policy if exists staging_auth_insert on staging.business_events;
create policy staging_auth_insert on staging.business_events
  for insert to authenticated with check (true);

alter table staging.user_activity enable row level security;
drop policy if exists staging_admin_read on staging.user_activity;
create policy staging_admin_read on staging.user_activity
  for select to authenticated using (staging.has_role(auth.uid(), 'admin'));
drop policy if exists staging_auth_insert on staging.user_activity;
create policy staging_auth_insert on staging.user_activity
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists staging_auth_update on staging.user_activity;
create policy staging_auth_update on staging.user_activity
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table staging.system_events enable row level security;
drop policy if exists staging_admin_read on staging.system_events;
create policy staging_admin_read on staging.system_events
  for select to authenticated using (staging.has_role(auth.uid(), 'admin'));
drop policy if exists staging_auth_insert on staging.system_events;
create policy staging_auth_insert on staging.system_events
  for insert to authenticated with check (true);
drop policy if exists staging_admin_update on staging.system_events;
create policy staging_admin_update on staging.system_events
  for update to authenticated using (staging.has_role(auth.uid(), 'admin')) with check (staging.has_role(auth.uid(), 'admin'));

alter table staging.inventory_change_logs enable row level security;
drop policy if exists staging_admin_read on staging.inventory_change_logs;
create policy staging_admin_read on staging.inventory_change_logs
  for select to authenticated using (staging.has_role(auth.uid(), 'admin'));
drop policy if exists staging_auth_insert on staging.inventory_change_logs;
create policy staging_auth_insert on staging.inventory_change_logs
  for insert to authenticated with check (auth.uid() is not null);
drop policy if exists staging_admin_delete on staging.inventory_change_logs;
create policy staging_admin_delete on staging.inventory_change_logs
  for delete to authenticated using (staging.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 7. GRANTS (re-run defensively; 20260919 already granted these at the
--    schema level, this just ensures every table/view created above,
--    plus anything added later, is covered)
-- =====================================================================

grant usage on schema staging to anon, authenticated;
grant all on all tables in schema staging to anon, authenticated;
alter default privileges in schema staging grant all on tables to anon, authenticated;

-- Done. Verify with:
--   select table_name from information_schema.tables where table_schema = 'staging' order by table_name;
--   select routine_name from information_schema.routines where routine_schema = 'staging' order by routine_name;
