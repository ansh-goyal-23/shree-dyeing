-- 20260926_staging_data_copy.sql
--
-- Copies real production data (public schema) into the tables added by
-- 20260926_staging_schema_full.sql, so the staging site has something
-- realistic to click through instead of empty tabs. Follows the exact
-- pattern already established in 20260919_staging_schema.sql for
-- staging.user_roles / staging.master_items: a plain
-- `insert into staging.X select * from public.X on conflict (id) do nothing`
-- per table, in FK dependency order (parents before children).
--
-- Because every staging.X table here was created with
-- `like public.X including all`, column names/order are identical between
-- public.X and staging.X, so `select *` copies cleanly without needing to
-- name every column by hand.
--
-- THIS IS A ONE-TIME SEED, NOT A SYNC. It is safe and idempotent to
-- re-run any time you want staging to pick up new/changed production rows
-- (ON CONFLICT DO NOTHING means it only ADDS rows that don't already exist
-- in staging by id -- it will NOT reflect an UPDATE or DELETE made in
-- production after the first run). See Software/Release-Status.md for the
-- discussion on whether/how to make this continuous.
--
-- OUT OF SCOPE (deliberately not touched here):
--   - staging.lots / recipes / process steps -- 20260919_staging_schema.sql
--     intentionally left these EMPTY (structure only) so Cotton/Nylon lot
--     creation could be tested on a clean slate, not mixed with real
--     production lots. Not changed by this file.
--   - staging.orders -- staging-only table, no production counterpart yet.
--   - business_events / user_activity / system_events / inventory_change_logs
--     -- these are audit trails, not data to test against; copying real
--     production audit history into a test schema isn't useful and mixes
--     real user activity with test activity. Not copied.
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor, AFTER
-- 20260926_staging_schema_full.sql. SAFE / additive: only inserts rows,
-- never updates or deletes, and only ever writes into `staging.*`.

-- ---------- Clients & Rates ----------
insert into staging.clients select * from public.clients on conflict (id) do nothing;
insert into staging.client_rate_master select * from public.client_rate_master on conflict (id) do nothing;

-- ---------- Expenses master data (no dependencies) ----------
insert into staging.suppliers select * from public.suppliers on conflict (id) do nothing;
insert into staging.company_master select * from public.company_master on conflict (id) do nothing;
insert into staging.expense_categories select * from public.expense_categories on conflict (id) do nothing;
insert into staging.expense_items select * from public.expense_items on conflict (id) do nothing;

-- ---------- Dispatch (Challans) ----------
insert into staging.challans select * from public.challans on conflict (id) do nothing;
insert into staging.challan_items select * from public.challan_items on conflict (id) do nothing;

-- ---------- Expenses ----------
insert into staging.expenses select * from public.expenses on conflict (id) do nothing;
insert into staging.expense_line_items select * from public.expense_line_items on conflict (id) do nothing;
insert into staging.expense_documents select * from public.expense_documents on conflict (id) do nothing;

-- ---------- Store ----------
insert into staging.store_racks select * from public.store_racks on conflict (id) do nothing;
insert into staging.store_items select * from public.store_items on conflict (id) do nothing;
insert into staging.store_stock_transactions select * from public.store_stock_transactions on conflict (id) do nothing;
insert into staging.store_assets select * from public.store_assets on conflict (id) do nothing;
insert into staging.store_asset_movements select * from public.store_asset_movements on conflict (id) do nothing;
insert into staging.store_verification_sessions select * from public.store_verification_sessions on conflict (id) do nothing;
insert into staging.store_verification_lines select * from public.store_verification_lines on conflict (id) do nothing;
insert into staging.store_yarn_receipts select * from public.store_yarn_receipts on conflict (id) do nothing;

-- ---------- Refresh roles / master items too (idempotent, see 20260919's own note) ----------
insert into staging.user_roles (id, user_id, role, created_at)
select id, user_id, role, created_at from public.user_roles
on conflict (id) do nothing;

insert into staging.master_items (id, user_id, name, type, shade_family, company, unit, is_active, short_name)
select id, user_id, name, type, shade_family, company, unit, is_active, short_name from public.master_items
on conflict (id) do nothing;

-- Done. Verify row counts landed as expected, e.g.:
--   select 'clients' t, count(*) from staging.clients
--   union all select 'challans', count(*) from staging.challans
--   union all select 'expenses', count(*) from staging.expenses
--   union all select 'store_items', count(*) from staging.store_items;
