-- 20260926_orders_staging.sql
--
-- Staging-schema companion to 20260926_orders.sql. Same "Orders" module,
-- fully re-qualified to the `staging` schema so it can be used immediately
-- on the staging site (per Ansh's choice of staging as the target branch,
-- 2026-09-26). See 20260926_orders.sql for full design-decision commentary
-- (matching logic, live-calculation rationale, known duplicate-shade
-- limitation) -- not repeated here to avoid drift between the two copies.
--
-- Depends on 20260926_staging_schema_full.sql already having been run
-- (needs staging.clients, staging.challans, staging.challan_items to exist).
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: only creates new objects, touches no existing table.

create table if not exists staging.orders (
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

create index if not exists idx_orders_client on staging.orders (lower(client_name));
create index if not exists idx_orders_shade on staging.orders (lower(shade_no));
create index if not exists idx_orders_date on staging.orders (order_date desc);
create index if not exists idx_orders_cancelled on staging.orders (is_cancelled);

drop trigger if exists trg_orders_updated_at on staging.orders;
create trigger trg_orders_updated_at
  before update on staging.orders
  for each row execute function public.tg_store_set_updated_at();

grant select, insert, update, delete on staging.orders to authenticated;
grant all on staging.orders to service_role;

alter table staging.orders enable row level security;

drop policy if exists "orders_read" on staging.orders;
create policy "orders_read" on staging.orders
  for select to authenticated using (true);

drop policy if exists "orders_write" on staging.orders;
create policy "orders_write" on staging.orders
  for all to authenticated using (true) with check (true);

-- ---------- Live status view ----------

create or replace view staging.orders_with_status as
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
from staging.orders o
left join lateral (
  select sum(ci.net_weight) as qty_sent
  from staging.challan_items ci
  join staging.challans c on c.id = ci.challan_id
  join staging.clients cl on cl.id = c.client_id
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

grant select on staging.orders_with_status to authenticated;
grant select on staging.orders_with_status to service_role;

-- ---------- "Possible duplicate" helper view ----------

create or replace view staging.orders_possible_duplicates as
select o.id
from staging.orders o
where not o.is_cancelled
  and (o.shade_no is null or trim(o.shade_no) = '')
  and exists (
    select 1 from staging.orders o2
    where o2.id <> o.id
      and not o2.is_cancelled
      and (o2.shade_no is null or trim(o2.shade_no) = '')
      and lower(trim(o2.client_name)) = lower(trim(o.client_name))
      and lower(trim(o2.color_name)) = lower(trim(o.color_name))
      and coalesce(lower(trim(o2.yarn_type)), '') = coalesce(lower(trim(o.yarn_type)), '')
  );

grant select on staging.orders_possible_duplicates to authenticated;
grant select on staging.orders_possible_duplicates to service_role;
