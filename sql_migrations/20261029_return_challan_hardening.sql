-- 20261029_return_challan_hardening.sql
--
-- Hardens the Return Challan feature (built 1 Oct, promoted 3 Oct). Fixes the
-- risks found in the 29 Oct review:
--
--   1. Numbering   -- RET-n was computed in the browser as max+1 from a list
--                     that could still be empty on first render, with no
--                     unique constraint. Now assigned by the database from a
--                     sequence, and made unique.
--   2. Over-return -- nothing stopped returning more than was dispatched, or
--                     the same line twice. Now enforced per original challan
--                     line (net kg, units, extra cones), serialised with a row
--                     lock so two simultaneous returns cannot both pass.
--   3. Atomicity   -- header, lines and store restock were three separate
--                     client writes; a failed restock was silently skipped.
--                     create_challan_return() does all of it in ONE
--                     transaction and reports lots that were not restocked.
--   4. Orders      -- orders_with_status ignored returns, so returned yarn
--                     still counted as sent. It now nets returns out.
--
-- Target schema: public
-- SAFE: both return tables were empty when this was written (0 rows in public
-- and staging). Everything is re-runnable (IF NOT EXISTS / OR REPLACE).
-- Backward compatible: the old frontend (client-side numbering + restock)
-- keeps working against these changes; only the over-return/uniqueness checks
-- apply to it.

-- =====================================================================
-- 1. Numbering: sequence + trigger + unique index
-- =====================================================================
-- The sequence is only seeded when first created, from the highest existing
-- RET-n (or the floor below). public floor: 0 -- staging's floor is high
-- on purpose so a test return created directly on staging can never collide
-- with a RET-n that the production->staging mirror later copies in.
do $$
begin
  if to_regclass('public.challan_return_seq') is null then
    create sequence public.challan_return_seq;
    perform setval('public.challan_return_seq',
      greatest(
        coalesce((select max((regexp_match(return_number, '^RET-(\d+)$', 'i'))[1]::int)
                  from public.challan_returns), 0),
        0) + 1,
      false);
  end if;
end $$;

create or replace function public.next_challan_return_number()
returns text
language sql
security definer
set search_path to 'public'
as $$ select 'RET-' || nextval('public.challan_return_seq')::text; $$;

create or replace function public.tg_challan_return_assign_number()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if NEW.return_number is null or btrim(NEW.return_number) = '' then
    NEW.return_number := public.next_challan_return_number();
  else
    NEW.return_number := btrim(NEW.return_number);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_challan_return_assign_number on public.challan_returns;
create trigger trg_challan_return_assign_number
  before insert on public.challan_returns
  for each row execute function public.tg_challan_return_assign_number();

create unique index if not exists uq_challan_returns_number
  on public.challan_returns (upper(btrim(return_number)));

-- =====================================================================
-- 2. Integrity: required links, non-negative quantities, over-return guard
-- =====================================================================
alter table public.challan_return_items alter column original_challan_id set not null;
alter table public.challan_return_items alter column original_challan_item_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'challan_return_items_qty_nonneg'
                   and conrelid = 'public.challan_return_items'::regclass) then
    alter table public.challan_return_items
      add constraint challan_return_items_qty_nonneg check (
        returned_gross_weight >= 0 and returned_net_weight >= 0
        and returned_num_of_units >= 0 and returned_extra_cones >= 0
        and rate >= 0 and amount >= 0 and paper_tube_surcharge >= 0);
  end if;
end $$;

create or replace function public.tg_challan_return_item_validate()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  oi record;
  hdr_client uuid;
  prev_net numeric;
  prev_units integer;
  prev_cones integer;
begin
  -- Lock the original line so two simultaneous returns against it queue up
  -- instead of both passing the check below.
  select ci.id, ci.challan_id, ci.lot_no, ci.net_weight, ci.num_of_units,
         coalesce(ci.extra_cones, 0) as extra_cones, c.client_id, c.challan_kind
    into oi
    from public.challan_items ci
    join public.challans c on c.id = ci.challan_id
   where ci.id = NEW.original_challan_item_id
   for update of ci;

  if not found then
    raise exception 'Original challan line not found.' using errcode = 'check_violation';
  end if;
  if oi.challan_id <> NEW.original_challan_id then
    raise exception 'Return line does not belong to the stated original challan.' using errcode = 'check_violation';
  end if;
  if oi.challan_kind = 'edy' then
    raise exception 'EDY challans cannot be returned through a Return Challan.' using errcode = 'check_violation';
  end if;

  select client_id into hdr_client from public.challan_returns where id = NEW.return_id;
  if hdr_client is distinct from oi.client_id then
    raise exception 'Lot % was dispatched to a different client than this return.', oi.lot_no using errcode = 'check_violation';
  end if;

  if NEW.returned_net_weight <= 0.0005 then
    raise exception 'Returned net weight for lot % must be greater than zero.', oi.lot_no using errcode = 'check_violation';
  end if;

  select coalesce(sum(returned_net_weight), 0),
         coalesce(sum(returned_num_of_units), 0),
         coalesce(sum(returned_extra_cones), 0)
    into prev_net, prev_units, prev_cones
    from public.challan_return_items
   where original_challan_item_id = NEW.original_challan_item_id
     and id <> NEW.id;

  if prev_net + NEW.returned_net_weight > oi.net_weight + 0.0005 then
    raise exception 'Cannot return % kg of lot %: only % kg remain on that challan line (dispatched %, already returned %).',
      round(NEW.returned_net_weight, 3), oi.lot_no,
      round(greatest(oi.net_weight - prev_net, 0), 3), round(oi.net_weight, 3), round(prev_net, 3)
      using errcode = 'check_violation';
  end if;
  if prev_units + NEW.returned_num_of_units > oi.num_of_units then
    raise exception 'Cannot return % unit(s) of lot %: only % remain on that challan line.',
      NEW.returned_num_of_units, oi.lot_no, greatest(oi.num_of_units - prev_units, 0)
      using errcode = 'check_violation';
  end if;
  if prev_cones + NEW.returned_extra_cones > oi.extra_cones then
    raise exception 'Cannot return % extra cone(s) of lot %: only % remain on that challan line.',
      NEW.returned_extra_cones, oi.lot_no, greatest(oi.extra_cones - prev_cones, 0)
      using errcode = 'check_violation';
  end if;

  return NEW;
end $$;

drop trigger if exists trg_challan_return_item_validate on public.challan_return_items;
create trigger trg_challan_return_item_validate
  before insert or update on public.challan_return_items
  for each row execute function public.tg_challan_return_item_validate();

-- =====================================================================
-- 3. Atomic create: header + lines + store restock in ONE transaction
-- =====================================================================
-- Runs as the caller (SECURITY INVOKER), so row-level security still applies.
-- Restock mirrors dispatch: one `challan_return` transaction per lot against
-- store item FG-<lot_no> (or EDY-<lot_no>). A lot with no store item is not
-- an error (same as dispatch) but is now REPORTED back in skipped_lots
-- instead of being dropped silently. Any other failure rolls back everything.
create or replace function public.create_challan_return(p_header jsonb, p_items jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_number text;
  v_client uuid;
  v_date date;
  v_skipped text[] := '{}';
  v_restocked integer := 0;
  r record;
  v_item record;
begin
  v_client := nullif(p_header->>'client_id', '')::uuid;
  v_date := coalesce(nullif(p_header->>'date', '')::date, current_date);

  if v_client is null then
    raise exception 'Client is required for a return challan.' using errcode = 'check_violation';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A return challan needs at least one line.' using errcode = 'check_violation';
  end if;

  insert into public.challan_returns
    (return_number, date, client_id, notes, prepared_by_name, received_by_name,
     received_by_contact_number, created_by)
  values
    (nullif(btrim(p_header->>'return_number'), ''), v_date, v_client,
     p_header->>'notes', p_header->>'prepared_by_name', p_header->>'received_by_name',
     p_header->>'received_by_contact_number', auth.uid())
  returning id, return_number into v_id, v_number;

  insert into public.challan_return_items
    (return_id, original_challan_id, original_challan_item_id, lot_no, shade_number,
     color_name, denier, ref_no, lot_type, packaging_type, returned_gross_weight,
     returned_net_weight, returned_num_of_units, returned_extra_cones, rate,
     rate_tier_label, paper_tube_surcharge, amount, reason, reason_note, created_by)
  select v_id, x.original_challan_id, x.original_challan_item_id, x.lot_no, x.shade_number,
         x.color_name, x.denier, x.ref_no, x.lot_type, x.packaging_type,
         coalesce(x.returned_gross_weight, 0), coalesce(x.returned_net_weight, 0),
         coalesce(x.returned_num_of_units, 0), coalesce(x.returned_extra_cones, 0),
         coalesce(x.rate, 0), x.rate_tier_label, coalesce(x.paper_tube_surcharge, 0),
         coalesce(x.amount, 0), coalesce(nullif(x.reason, ''), 'Other'), x.reason_note,
         auth.uid()
    from jsonb_to_recordset(p_items) as x(
      original_challan_id uuid, original_challan_item_id uuid, lot_no text,
      shade_number text, color_name text, denier text, ref_no text, lot_type text,
      packaging_type text, returned_gross_weight numeric, returned_net_weight numeric,
      returned_num_of_units integer, returned_extra_cones integer, rate numeric,
      rate_tier_label text, paper_tube_surcharge numeric, amount numeric,
      reason text, reason_note text);

  for r in
    select lot_no, sum(returned_net_weight) as qty
      from public.challan_return_items
     where return_id = v_id and coalesce(lot_no, '') <> ''
     group by lot_no
    having sum(returned_net_weight) > 0.00001
  loop
    select id, unit into v_item
      from public.store_items
     where item_code in ('FG-' || r.lot_no, 'EDY-' || r.lot_no)
     order by (item_code like 'FG-%') desc
     limit 1;

    if not found then
      v_skipped := v_skipped || r.lot_no;
      continue;
    end if;

    insert into public.store_stock_transactions
      (transaction_number, transaction_date, transaction_type, item_id, quantity, unit,
       reference_type, reference_number, remarks)
    values
      (public.next_store_txn_number(), v_date, 'challan_return', v_item.id, r.qty, v_item.unit,
       'challan_return', v_number, 'Return ' || v_number);
    v_restocked := v_restocked + 1;
  end loop;

  return jsonb_build_object(
    'id', v_id,
    'return_number', v_number,
    'restocked_lots', v_restocked,
    'skipped_lots', to_jsonb(v_skipped));
end $$;

revoke all on function public.create_challan_return(jsonb, jsonb) from public, anon;
grant execute on function public.create_challan_return(jsonb, jsonb) to authenticated, service_role;
revoke all on function public.next_challan_return_number() from public, anon;
grant execute on function public.next_challan_return_number() to authenticated, service_role;

-- =====================================================================
-- 4. Orders: returned yarn no longer counts as sent
-- =====================================================================
-- Same view as before; the only change is that each matched challan line
-- contributes (net_weight - kg returned against that exact line).
create or replace view public.orders_with_status as
select
  o.id,
  o.client_name,
  o.poc,
  o.order_date,
  o.color_name,
  o.yarn_type,
  o.sample_type,
  o.shade_no,
  o.order_qty,
  o.uom,
  o.notes,
  o.is_cancelled,
  o.created_at,
  o.updated_at,
  o.created_by,
  coalesce(m.qty_sent, 0)::numeric(18, 4) as qty_sent,
  (o.order_qty - coalesce(m.qty_sent, 0))::numeric(18, 4) as balance_qty,
  case
    when o.is_cancelled then 'Cancelled'
    when (o.order_qty - coalesce(m.qty_sent, 0)) <= 0.001 then 'Fulfilled'
    when coalesce(m.qty_sent, 0) > 0 then 'Partially Sent'
    else 'Open'
  end as status
from public.orders o
left join lateral (
  select sum(ci.net_weight - coalesce(rt.returned_net, 0)) as qty_sent
  from public.challan_items ci
  join public.challans c on c.id = ci.challan_id
  join public.clients cl on cl.id = c.client_id
  left join (
    select original_challan_item_id, sum(returned_net_weight) as returned_net
    from public.challan_return_items
    group by original_challan_item_id
  ) rt on rt.original_challan_item_id = ci.id
  where lower(trim(cl.client_name)) = lower(trim(o.client_name))
    and (
      (o.shade_no is not null and trim(o.shade_no) <> ''
        and lower(trim(ci.shade_number)) = lower(trim(o.shade_no)))
      or
      (
        (o.shade_no is null or trim(o.shade_no) = '')
        and lower(trim(ci.color_name)) = lower(trim(o.color_name))
        and coalesce(lower(trim(ci.denier)), '') = coalesce(lower(trim(o.yarn_type)), '')
        and c.date >= o.order_date
      )
    )
) m on true;

-- =====================================================================
-- Rollback (if ever needed)
-- =====================================================================
--   drop function if exists public.create_challan_return(jsonb, jsonb);
--   drop trigger if exists trg_challan_return_item_validate on public.challan_return_items;
--   drop function if exists public.tg_challan_return_item_validate();
--   drop trigger if exists trg_challan_return_assign_number on public.challan_returns;
--   drop function if exists public.tg_challan_return_assign_number();
--   drop function if exists public.next_challan_return_number();
--   drop index if exists public.uq_challan_returns_number;
--   alter table public.challan_return_items drop constraint if exists challan_return_items_qty_nonneg;
--   -- orders_with_status: re-run the view from 20260926_orders*.sql
