-- 20260926_orders.sql
--
-- New "Orders" module: a lightweight, manually-fed table of client orders
-- received (matching the columns of Ansh's working order sheet: Client,
-- POC, Date, Colour, Yarn Type, Sample Type, Shade No, Order Qty, UOM),
-- with Qty Sent / Balance Qty computed live from actual dispatches rather
-- than stored -- so they can never drift out of sync with what's actually
-- been challan'd, and self-correct if a challan is later edited or deleted.
-- This mirrors the "current stock is always a derived SUM, never stored"
-- principle already used for Store (see Software/Decisions-Log.md).
--
-- Design decisions confirmed with Ansh (2026-09-26):
--   - Matching a challan to an order is fully automatic, not a manual pick.
--     It matches on client + colour + yarn type ("denier" in challan_items)
--     always, and ALSO on shade no. once the order has one.
--   - Qty Sent / Balance Qty are live-calculated (a view), not stored columns.
--   - Built here for `public` (production) to ship later; also applied to
--     `staging` right away in 20260926_orders_staging.sql so it can be used
--     immediately on the staging site (see Software/Release-Status.md).
--
-- MATCHING LOGIC (see the view below) -- and its one real limitation:
--   - If an order already has a Shade No., a challan line matches it by
--     client + shade no. ALONE (colour/yarn type are ignored at that point
--     -- the shade no. is treated as the authoritative identifier once one
--     exists, since colour spelling can drift but the shade code doesn't).
--   - If an order has NO shade no. yet (most new/sample orders start this
--     way), a challan line matches by client + colour + yarn type, and only
--     counts challans dated on/after the order's own date (to stop it
--     picking up an unrelated EARLIER dispatch of a same-named colour).
--   - KNOWN LIMITATION: two still-open orders for the same client + colour
--     + yarn type that BOTH lack a shade no. cannot be told apart -- a
--     matching challan is counted against both, double-counting the
--     dispatch. This resolves itself as soon as either order gets a shade
--     no. The Orders list page flags this case so it's visible, not silent.
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: only creates new objects, touches no existing table.

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  client_name   text not null,
  poc           text,
  order_date    date not null default current_date,
  color_name    text not null,
  yarn_type     text,
  sample_type   text,
  shade_no      text,
  order_qty     numeric(18, 4) not null default 0,
  uom           text not null default 'KG',
  notes         text,
  is_cancelled  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) default auth.uid()
);

create index if not exists idx_orders_client on public.orders (lower(client_name));
create index if not exists idx_orders_shade on public.orders (lower(shade_no));
create index if not exists idx_orders_date on public.orders (order_date desc);
create index if not exists idx_orders_cancelled on public.orders (is_cancelled);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.tg_store_set_updated_at();

grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.orders enable row level security;

drop policy if exists "orders_read" on public.orders;
create policy "orders_read" on public.orders
  for select to authenticated using (true);

drop policy if exists "orders_write" on public.orders;
create policy "orders_write" on public.orders
  for all to authenticated using (true) with check (true);

-- ---------- Live status view ----------

create or replace view public.orders_with_status as
select
  o.*,
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
  select sum(ci.net_weight) as qty_sent
  from public.challan_items ci
  join public.challans c on c.id = ci.challan_id
  join public.clients cl on cl.id = c.client_id
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

grant select on public.orders_with_status to authenticated;
grant select on public.orders_with_status to service_role;

-- ---------- "Possible duplicate" helper view ----------
-- Flags open (not cancelled/fulfilled), shade-less orders that share the
-- same client + colour + yarn type with another such order -- the one case
-- the matching logic above can't tell apart. Surfaced in the Orders list UI.

create or replace view public.orders_possible_duplicates as
select o.id
from public.orders o
where not o.is_cancelled
  and (o.shade_no is null or trim(o.shade_no) = '')
  and exists (
    select 1 from public.orders o2
    where o2.id <> o.id
      and not o2.is_cancelled
      and (o2.shade_no is null or trim(o2.shade_no) = '')
      and lower(trim(o2.client_name)) = lower(trim(o.client_name))
      and lower(trim(o2.color_name)) = lower(trim(o.color_name))
      and coalesce(lower(trim(o2.yarn_type)), '') = coalesce(lower(trim(o.yarn_type)), '')
  );

grant select on public.orders_possible_duplicates to authenticated;
grant select on public.orders_possible_duplicates to service_role;
