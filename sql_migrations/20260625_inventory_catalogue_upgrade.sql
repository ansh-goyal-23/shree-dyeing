-- =====================================================================
-- Inventory Catalogue Upgrade — additive changes only.
-- =====================================================================
-- 1. store_items gets first_received_at (auto-stamped on first inflow).
-- 2. store_stock_inward gets bill_url / bill_path for invoice uploads.
-- 3. store_current_stock_by_item view recreated to expose latest rack +
--    first_received_date + last_transaction_date (single row per item).
-- 4. Storage bucket `inward-bills` for invoice attachments.
-- 5. Trigger to backfill first_received_at on inflows.
--
-- NOTHING is dropped. No existing data is moved. The old
-- store_current_stock view is preserved for backward compatibility.
-- =====================================================================

-- ---------- 1. store_items.first_received_at --------------------------

ALTER TABLE public.store_items
    ADD COLUMN IF NOT EXISTS first_received_at date;

CREATE INDEX IF NOT EXISTS idx_store_items_first_received
    ON public.store_items(first_received_at);

-- One-time backfill from existing inflow transactions.
UPDATE public.store_items i
SET first_received_at = sub.first_date
FROM (
    SELECT item_id, MIN(transaction_date) AS first_date
    FROM public.store_stock_transactions
    WHERE quantity > 0
    GROUP BY item_id
) sub
WHERE i.id = sub.item_id
  AND i.first_received_at IS NULL;

-- ---------- 2. store_stock_inward.bill_url / bill_path ----------------

ALTER TABLE public.store_stock_inward
    ADD COLUMN IF NOT EXISTS bill_url  text,
    ADD COLUMN IF NOT EXISTS bill_path text;

-- ---------- 3. store_current_stock_by_item view ----------------------
-- Single row per item. Latest rack = rack of the most recent transaction
-- having a non-null rack_id. first_received_date = MIN(date) for inflows.

DROP VIEW IF EXISTS public.store_current_stock_by_item;

CREATE VIEW public.store_current_stock_by_item AS
WITH agg AS (
    SELECT
        i.id                                AS item_id,
        COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_quantity,
        MAX(t.transaction_date)             AS last_transaction_date,
        MAX(t.created_at)                   AS last_transaction_at,
        MIN(t.transaction_date) FILTER (WHERE t.quantity > 0) AS first_received_date
    FROM public.store_items i
    LEFT JOIN public.store_stock_transactions t ON t.item_id = i.id
    GROUP BY i.id
),
latest_rack AS (
    SELECT DISTINCT ON (t.item_id)
        t.item_id,
        t.rack_id   AS latest_rack_id,
        r.rack_code AS latest_rack_code,
        r.rack_name AS latest_rack_name
    FROM public.store_stock_transactions t
    LEFT JOIN public.store_racks r ON r.id = t.rack_id
    WHERE t.rack_id IS NOT NULL
    ORDER BY t.item_id, t.transaction_date DESC, t.created_at DESC
)
SELECT
    i.id                                AS item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit,
    i.is_asset,
    i.created_at                        AS item_created_at,
    COALESCE(i.first_received_at, agg.first_received_date) AS first_received_date,
    i.default_rack                      AS default_rack_id,
    dr.rack_code                        AS default_rack_code,
    dr.rack_name                        AS default_rack_name,
    lr.latest_rack_id,
    lr.latest_rack_code,
    lr.latest_rack_name,
    agg.current_quantity,
    agg.last_transaction_date,
    agg.last_transaction_at
FROM public.store_items i
LEFT JOIN agg ON agg.item_id = i.id
LEFT JOIN latest_rack lr ON lr.item_id = i.id
LEFT JOIN public.store_racks dr ON dr.id = i.default_rack
WHERE i.is_active = true;

GRANT SELECT ON public.store_current_stock_by_item TO authenticated;
GRANT SELECT ON public.store_current_stock_by_item TO service_role;

-- ---------- 4. Storage bucket for invoice bills ----------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('inward-bills', 'inward-bills', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for the bucket
DROP POLICY IF EXISTS "inward_bills_read" ON storage.objects;
CREATE POLICY "inward_bills_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'inward-bills');

DROP POLICY IF EXISTS "inward_bills_write" ON storage.objects;
CREATE POLICY "inward_bills_write" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'inward-bills');

DROP POLICY IF EXISTS "inward_bills_update" ON storage.objects;
CREATE POLICY "inward_bills_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'inward-bills');

DROP POLICY IF EXISTS "inward_bills_delete" ON storage.objects;
CREATE POLICY "inward_bills_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'inward-bills');

-- ---------- 5. Trigger: stamp first_received_at on first inflow ------

CREATE OR REPLACE FUNCTION public.tg_store_items_first_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.quantity > 0 THEN
        UPDATE public.store_items
        SET first_received_at = NEW.transaction_date
        WHERE id = NEW.item_id
          AND first_received_at IS NULL;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_store_items_first_received
    ON public.store_stock_transactions;
CREATE TRIGGER trg_store_items_first_received
    AFTER INSERT ON public.store_stock_transactions
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_items_first_received();
