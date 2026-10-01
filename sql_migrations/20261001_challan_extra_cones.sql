-- 20261001_challan_extra_cones.sql
--
-- Public-schema companion to 20261001_challan_extra_cones_staging.sql.
-- See that file for the full explanation. Ships to production once the
-- manual extra-cones flow is verified on staging.
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: one new nullable-with-default column, no data touched.

alter table public.challan_items
  add column if not exists extra_cones integer not null default 0;

comment on column public.challan_items.extra_cones is
  'Extra paper-tube cones billed on this line, entered manually by the challan maker. 0 unless packaging is paper_tube and the client has a cone surcharge configured. paper_tube_surcharge = extra_cones * clients.paper_tube_extra_cone_surcharge at the time the line was saved.';
