-- 20260926_orders_seed_staging.sql
--
-- Seeds staging.orders from Ansh's working order sheet (order_sheet_-_Sheet1.csv,
-- 75 rows, uploaded 2026-09-26). Run AFTER 20260926_orders_staging.sql.
--
-- Notes on the source data:
--   - Two clients in the sheet ("Guru Sharan", "Stich n Mends") are not yet in
--     staging.clients. client_name here is free text, so seeding still works --
--     but automatic shade/colour matching for their orders needs those clients
--     to exist as real clients (with matching name) once they start being used
--     on challans.
--   - 10 rows (Gayatri's "25-SEPT" rows, Stich n Mends' "25 Sept" rows) had no
--     year in the sheet -- defaulted to 2026 (matches the surrounding rows).
--   - The sheet's own QTY SENT / BALANCE QTY columns are NOT imported: those are
--     live-calculated by orders_with_status from matching challan_items instead,
--     per the design in 20260926_orders_staging.sql. Only order_qty (the
--     original ask) is stored. For rows with real shade numbers (e.g. N-1090)
--     that already have matching historical challans in staging, qty_sent /
--     balance_qty will populate correctly the first time the Orders page loads --
--     no separate backfill needed.
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor, AFTER
-- 20260926_orders_staging.sql. SAFE / additive: only inserts into staging.orders.

insert into staging.orders (client_name, poc, order_date, color_name, yarn_type, sample_type, shade_no, order_qty, uom) values
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'STRONG GRAY', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'SILVER FOG', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'SMOKEY GRAY', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'MOUSE GRAY', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'CHESTNUT BROWN', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'MIDNIGHT PLUM', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'FIN BLUE', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'CANDY APPLE', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'Puma Team Royal', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-10', 'EVENING BLUE', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-11', 'RESET BLUE', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-11', 'ALPINE SNOW', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'COOL BLUE 2/40 SPUN', '2/40', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'RICKIE ORANGE 2/40 SPUN', '2/40', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'DESERT DUST 2/40 SPUN', '2/40', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'SEA GREEN', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'RUBY SHIMMER 2/40 SPUN', '2/40', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'INTENSE RED 2/40 SPUN', '2/40', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-21', 'COOL WEATHER', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-22', 'COCA MOCHA', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'HAUTE COFFEE', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'WARM SAND', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'LUNAR ROCK', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'VINTAGE INDIGO', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'NIMBUS CLOUD', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'GARDENIA', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Girraj Ji', '2026-09-23', 'DAWN BLUE', '150/tex', null, null, 1, 'KG'),
  ('Shree Lace', 'Shiva', '2026-08-11', 'CASTLE ROCK', '150/tex', null, 'SAMPLE REC', 15, 'KG'),
  ('Shree Lace', 'Shiva', '2026-08-11', 'JET SET', '150/tex', null, 'N-1358', 78, 'KG'),
  ('Shree Lace', 'Shiva', '2026-08-11', 'PEACOAT', '150/tex', null, 'N-1390', 77, 'KG'),
  ('Shree Lace', 'Shiva', '2026-08-25', 'SALMON ROSE', '150/tex', null, 'N-1407', 7, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-01', 'DARK INDIGO', '150/tex', null, 'N-456', 9, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-01', 'DARK SHADOW', '150/tex', null, 'SAMPLE', 73, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-10', 'LAPISLAZULI', '150/tex', null, 'SAMPLE', 15, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-10', 'ORANGE GLO', '150/tex', null, 'SAMPLE', 22, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-10', 'FUTURE PINK', '150/tex', null, 'SAMPLE', 1, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-21', 'PORT', '150/tex', null, null, 12, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-22', 'ARUBA BLUE', '150/tex', null, 'N-1090', 40, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-22', 'PEACOCK BLUE', '150/tex', null, 'N-1140', 4, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-22', 'AZALEA', '150/tex', null, 'N-1130', 34, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-22', 'GOLD', '150/tex', null, 'N-1196', 3, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-22', 'LARKSPUR', '150/tex', null, 'N-1183', 17, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-24', 'DARK INDIGO', '150/tex', 'old ref recipe', 'SD-44', 1, 'KG'),
  ('Shree Lace', 'Shiva', '2026-09-24', 'FROSTED IVORY', '150/tex', 'old ref recipe', 'N006', 1, 'KG'),
  ('Himanshi Narrow Fabrics', 'Mani Sharma', '2026-09-25', 'GREY', '300 Rotto', 'Sample Yarn', null, 125, 'KG'),
  ('Guru Sharan', 'Dhruv Pandey', '2026-09-22', 'Royal Blue', '150/tex', 'Fabric Cutting', null, 7, 'KG'),
  ('Guru Sharan', 'Dhruv Pandey', '2026-09-22', 'Dark Red', '150/tex', 'Fabric Cutting', null, 6, 'KG'),
  ('Guru Sharan', 'Dhruv Pandey', '2026-09-22', 'Navy', '150/tex', 'Fabric Cutting', null, 11, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'ALBASTER', '150/tex', 'Fabric Cutting', null, 16, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'DEEP END BLUE', '150/tex', 'Fabric Cutting', null, 26, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'DUSTED BLUE', '150/tex', 'Fabric Cutting', null, 16, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'LAVENDER QUARTZ', '150/tex', 'Fabric Cutting', null, 7, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'NAVY NIGHTS', '150/tex', 'Fabric Cutting', null, 12, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'ULTRA MARINE', '150/tex', 'Fabric Cutting', null, 12, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'SOFT JADE', '150/tex', 'Fabric Cutting', null, 28, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'LATTE', '150/tex', 'Fabric Cutting', null, 0, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'UMIGAME GREEN', '150/tex', 'Fabric Cutting', null, 0, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'DUSTED BLUE - 2', '150/tex', 'Fabric Cutting', null, 0, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'ALBASTER - 2', '150/tex', 'Fabric Cutting', null, 9, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'BRIGHT OPAL', '150/tex', 'Fabric Cutting', null, 7, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'COCONUT', '150/tex', 'Fabric Cutting', null, 12, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'FOREST WHISPER', '150/tex', 'Fabric Cutting', null, 16, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'SEA SALT', '150/tex', 'Fabric Cutting', null, 13, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'OVERCAST', '150/tex', 'Fabric Cutting', null, 15, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-10', 'SOFT YELLOW', '150/tex', 'Fabric Cutting', null, 7, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-25', 'GREEN', '150/tex', null, null, 2, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-25', 'MAROON', '150/tex', null, null, 2, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-25', 'BROWN', '150/tex', null, null, 2, 'KG'),
  ('Gayatri', 'RAJESH', '2026-09-25', 'NAVY', '150/tex', null, null, 2, 'KG'),
  ('Stich n Mends', 'Vishal', '2026-09-25', 'OLIVE', '150/tex', 'Lace Cutting', null, 1, 'KG'),
  ('Stich n Mends', 'Vishal', '2026-09-25', 'SKY BLUE', '150/tex', 'Lace Cutting', null, 1, 'KG'),
  ('Stich n Mends', 'Vishal', '2026-09-25', 'DK KHAKI', '150/tex', 'Lace Cutting', null, 1, 'KG'),
  ('Stich n Mends', 'Vishal', '2026-09-25', 'LT BROWN', '150/tex', 'Lace Cutting', null, 1, 'KG'),
  ('Stich n Mends', 'Vishal', '2026-09-25', 'LT OLIVE', '150/tex', 'Lace Cutting', null, 1, 'KG'),
  ('Stich n Mends', 'Vishal', '2026-09-25', 'NAVY', '150/tex', 'Lace Cutting', null, 1, 'KG');
