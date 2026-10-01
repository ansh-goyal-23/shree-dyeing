-- 20261001_challan_extra_cones_staging.sql
--
-- Changes how the paper-tube cone surcharge is determined, per Ansh's
-- request (1 Oct 2026): instead of auto-computing "extra cones" from
-- net_weight / baseline_kg_per_cone vs num_of_units (20260928_client_rates_v2),
-- the challan maker now types the extra-cone count directly on the line.
-- The per-cone rupee rate (clients.paper_tube_extra_cone_surcharge) is still
-- used -- only where the cone count comes from has changed.
--
-- Adds `extra_cones` to challan_items as its own snapshot column (not just
-- folding straight into paper_tube_surcharge), so a saved challan keeps a
-- record of exactly how many extra cones were billed, not just the
-- resulting rupee amount -- same immutability principle as the other
-- snapshot columns (yarn_cost/overhead_rate/rate_tier_label/
-- paper_tube_surcharge, see 20260928_client_rates_v2.sql).
--
-- clients.paper_tube_baseline_kg_per_cone becomes unused by this new flow
-- (nothing is auto-derived from weight anymore) but is left in place --
-- harmless, and dropping it isn't part of what was asked for.
--
-- Staging companion -- run now. Public version in
-- 20261001_challan_extra_cones.sql ships to production once this is
-- verified on staging.
--
-- SAFE / additive: one new nullable-with-default column, no data touched.

alter table staging.challan_items
  add column if not exists extra_cones integer not null default 0;

comment on column staging.challan_items.extra_cones is
  'Extra paper-tube cones billed on this line, entered manually by the challan maker. 0 unless packaging is paper_tube and the client has a cone surcharge configured. paper_tube_surcharge = extra_cones * clients.paper_tube_extra_cone_surcharge at the time the line was saved.';

-- No mirror-trigger change needed: public -> staging mirroring
-- (public.tg_mirror_to_staging) builds its column list dynamically from
-- staging's own schema, so once this column exists in both public and
-- staging it's picked up automatically.
