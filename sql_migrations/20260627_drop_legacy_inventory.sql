-- =====================================================================
-- Drop legacy inventory module + unused duplicate view.
-- =====================================================================
-- These tables/columns belonged to the old (pre-Store) inventory engine
-- that was decommissioned. No code references them any longer.
-- =====================================================================

DROP TABLE IF EXISTS public.yarn_inventory            CASCADE;
DROP TABLE IF EXISTS public.material_inventory        CASCADE;
DROP TABLE IF EXISTS public.oil_inventory             CASCADE;
DROP TABLE IF EXISTS public.finished_goods_stock      CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions_v2 CASCADE;

ALTER TABLE public.lots
    DROP COLUMN IF EXISTS last_yarn_consumed,
    DROP COLUMN IF EXISTS last_dye_consumption,
    DROP COLUMN IF EXISTS last_chemical_consumption,
    DROP COLUMN IF EXISTS inventory_synced;

ALTER TABLE public.challans
    DROP COLUMN IF EXISTS last_oil_by_lot,
    DROP COLUMN IF EXISTS last_fg_by_lot,
    DROP COLUMN IF EXISTS inventory_synced;

-- Duplicate of store_current_stock_by_item (per item+rack split — not used).
DROP VIEW IF EXISTS public.store_current_stock CASCADE;
