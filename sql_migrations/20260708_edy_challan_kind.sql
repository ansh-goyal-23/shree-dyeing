-- Add challan_kind to distinguish production vs external-dyed-yarn dispatch.
alter table public.challans
  add column if not exists challan_kind text not null default 'production'
  check (challan_kind in ('production','edy'));

create index if not exists idx_challans_kind on public.challans(challan_kind);
