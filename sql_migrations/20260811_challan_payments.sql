-- Challan payment tracking: amount received + paid timestamp.
alter table public.challans
  add column if not exists amount_received numeric(14,2) not null default 0;

alter table public.challans
  add column if not exists paid_at timestamptz null;

create index if not exists challans_paid_at_idx on public.challans (paid_at);
