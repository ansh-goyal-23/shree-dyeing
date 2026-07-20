alter table public.challan_items
  add column if not exists lot_type text not null default 'Production'
  check (lot_type in ('Production','Sampling'));
