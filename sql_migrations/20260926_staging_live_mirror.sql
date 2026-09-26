-- 20260926_staging_live_mirror.sql
--
-- Live, ONE-WAY mirror: public.<table> -> staging.<table>. Every insert,
-- update or delete on the listed production tables is copied into the
-- matching staging table immediately, in the same transaction. There is
-- NO reverse direction -- nothing you do on staging (test orders, test
-- challans, edits, deletes) ever touches `public`. Staging is purely a
-- read-and-play copy that happens to always be fresh.
--
-- SAFETY -- THIS MUST NEVER BREAK PRODUCTION:
--   The mirror logic runs inside a BEGIN/EXCEPTION block. If mirroring a
--   row into staging fails for ANY reason (a staging FK violation, a
--   staging-only row blocking a delete, staging schema drift, anything),
--   the error is caught, logged as a WARNING (visible in Supabase's
--   Postgres logs), and swallowed -- the production statement that
--   triggered it ALWAYS completes normally. A bug in this file can make
--   staging stale or wrong; it cannot make a production write fail.
--
-- HOW IT WORKS (one generic trigger function, reused by every table):
--   Because every staging.<table> here was created with
--   `like public.<table> including all` (20260926_staging_schema_full.sql),
--   column names/order are identical between the two copies of a table.
--   `insert into staging.<table> select ($1).* on conflict (id) do update
--   set col = excluded.col, ...` therefore works for any of them without
--   hand-writing a column list per table -- the UPDATE SET clause is built
--   once, at CREATE TRIGGER time is not needed since it's computed inside
--   the function body from information_schema on each call (cheap: single
--   small in-memory catalog lookup, not a real query against user data).
--   Every one of these tables uses `id` as its primary key (confirmed from
--   the FK definitions in 20260926_staging_schema_full.sql), which is what
--   ON CONFLICT keys on.
--
-- SCOPE: the same 18 tables 20260926_staging_data_copy.sql backfilled --
-- Clients & Rates, Dispatch, Expenses, Store. Deliberately NOT applied to:
--   - lots / recipes / process steps -- kept clean for lot-creation testing,
--     per the original intent in 20260919_staging_schema.sql.
--   - staging.orders -- staging-only, no production counterpart.
--   - business_events / user_activity / system_events / inventory_change_logs
--     -- audit trails; mixing real production activity into a test schema
--     isn't useful and these are logged separately by the app anyway.
--   - user_roles / master_items -- unchanged; keep using the manual,
--     idempotent re-run described in 20260919_staging_schema.sql (roles and
--     master items change rarely, and role assignment is intentionally
--     independent per schema).
--
-- KNOWN EDGE CASE: if a client is deleted in production, mirroring that
-- delete into staging can fail if a STAGING-ONLY test challan (never in
-- production) references that client's id, because staging.challans has
-- `on delete restrict`. Per the safety rule above, that failure is caught
-- and only logged -- production's delete still succeeds, and the client
-- row simply becomes stale on staging. Address it, if it ever comes up, by
-- clearing the staging-only test rows referencing it.
--
-- Run this AFTER 20260926_staging_schema_full.sql and
-- 20260926_staging_data_copy.sql (mirror new writes onto a base that
-- already has today's data; anything written before this runs is only
-- captured by re-running the one-time copy script).
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.

create or replace function public.tg_mirror_to_staging()
returns trigger
language plpgsql
security definer
set search_path = public, staging
as $$
declare
  update_set text;
begin
  begin
    if TG_OP = 'DELETE' then
      execute format('delete from staging.%I where id = $1', TG_TABLE_NAME) using OLD.id;
    else
      select string_agg(format('%I = excluded.%I', column_name, column_name), ', ')
      into update_set
      from information_schema.columns
      where table_schema = 'staging' and table_name = TG_TABLE_NAME and column_name <> 'id';

      execute format(
        'insert into staging.%I select ($1).* on conflict (id) do update set %s',
        TG_TABLE_NAME, update_set
      ) using NEW;
    end if;
  exception when others then
    -- NEVER let a mirroring failure break the production write that
    -- triggered it. Log it (visible in Supabase's Postgres logs under
    -- "Logs > Postgres Logs") and move on.
    raise warning 'staging mirror failed for %.% (id=%): %',
      TG_TABLE_NAME, TG_OP, coalesce(NEW.id, OLD.id), SQLERRM;
  end;
  return coalesce(NEW, OLD);
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'clients', 'client_rate_master',
    'suppliers', 'company_master', 'expense_categories', 'expense_items',
    'challans', 'challan_items',
    'expenses', 'expense_line_items', 'expense_documents',
    'store_racks', 'store_items', 'store_stock_transactions',
    'store_assets', 'store_asset_movements',
    'store_verification_sessions', 'store_verification_lines',
    'store_yarn_receipts'
  ])
  loop
    execute format('drop trigger if exists trg_mirror_to_staging on public.%I;', t);
    execute format(
      'create trigger trg_mirror_to_staging after insert or update or delete on public.%I for each row execute function public.tg_mirror_to_staging();',
      t
    );
  end loop;
end $$;

-- Done. Verify with:
--   select event_object_table, trigger_name from information_schema.triggers
--   where trigger_name = 'trg_mirror_to_staging' order by event_object_table;
--
-- To test: create/edit a client, challan or expense in the LIVE (production)
-- app, then check it appears in the matching staging table within a second.
--
-- To remove this later (e.g. once staging is merged into main and this
-- distinction stops making sense):
--   do $$ declare t text; begin
--     for t in select unnest(array[
--       'clients','client_rate_master','suppliers','company_master',
--       'expense_categories','expense_items','challans','challan_items',
--       'expenses','expense_line_items','expense_documents','store_racks',
--       'store_items','store_stock_transactions','store_assets',
--       'store_asset_movements','store_verification_sessions',
--       'store_verification_lines','store_yarn_receipts'
--     ]) loop
--       execute format('drop trigger if exists trg_mirror_to_staging on public.%I;', t);
--     end loop;
--   end $$;
--   drop function if exists public.tg_mirror_to_staging();
