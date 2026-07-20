-- Snapshot denier onto challan items so the challan stays stable when the
-- underlying lot's details change later. Existing rows are back-filled from
-- the lots table where possible.
alter table public.challan_items
  add column if not exists denier text;

update public.challan_items ci
set denier = l.denier
from public.lots l
where ci.denier is null
  and l.lot_no = ci.lot_no;
