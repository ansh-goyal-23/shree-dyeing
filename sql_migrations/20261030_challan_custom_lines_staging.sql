-- 20261030_challan_custom_lines_staging.sql
--
-- "Other item" lines on a challan: a free-text description + a directly
-- entered amount, for things we send that are not yarn we dyed (tools, raw
-- material, anything else). Requested 30 Oct 2026.
--
--   is_custom   -- true for these lines. Product lines stay false.
--   description -- what was sent, in the challan maker's words (required
--                  when is_custom). Product lines leave it null.
--
-- A custom line is stored as an ordinary challan_items row with lot_no = '',
-- weights/units/rate = 0 and amount = the typed amount, so everything that
-- adds up `amount` (challan total, payment status, party ledger, admin
-- revenue) picks it up unchanged, and everything keyed on lot/kg
-- (store stock, production and oil reports, orders, returns) ignores it
-- because it has no lot and 0 kg.
--
-- IMPORTANT: the live mirror trigger copies challan_items rows public ->
-- staging POSITIONALLY (`insert into staging.t select ($1).*`). The two new
-- columns must therefore exist in BOTH schemas in the SAME order, or the
-- mirror silently stops copying challan lines. Apply the public and staging
-- files together.
--
-- Target schema: staging
-- SAFE / additive: new columns have defaults, existing rows are untouched.
-- Re-runnable.

alter table staging.challan_items
  add column if not exists is_custom boolean not null default false,
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'staging' and t.relname = 'challan_items'
      and c.conname = 'challan_items_custom_line_valid'
  ) then
    alter table staging.challan_items
      add constraint challan_items_custom_line_valid
      check (
        is_custom = false
        or (
          length(btrim(coalesce(description, ''))) > 0
          and coalesce(amount, 0) >= 0
          and coalesce(net_weight, 0) = 0
        )
      );
  end if;
end $$;

-- =====================================================================
-- Rollback (if ever needed; this deletes the text of any custom lines)
-- =====================================================================
--   alter table staging.challan_items drop constraint if exists challan_items_custom_line_valid;
--   alter table staging.challan_items drop column if exists description;
--   alter table staging.challan_items drop column if exists is_custom;
