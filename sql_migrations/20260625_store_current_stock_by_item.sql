-- =====================================================================
-- Current Stock — item-level aggregate view (derived from transactions)
-- =====================================================================
-- store_current_stock (existing) groups by (item, rack).
-- This new view aggregates strictly per item and includes
-- last_transaction_date / last_transaction_at for the Current Stock page.
-- =====================================================================

CREATE OR REPLACE VIEW public.store_current_stock_by_item AS
SELECT
    i.id                                AS item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit,
    i.is_asset,
    i.default_rack                      AS default_rack_id,
    dr.rack_code                        AS default_rack_code,
    dr.rack_name                        AS default_rack_name,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4)  AS current_quantity,
    MAX(t.transaction_date)             AS last_transaction_date,
    MAX(t.created_at)                   AS last_transaction_at
FROM public.store_items i
LEFT JOIN public.store_stock_transactions t ON t.item_id = i.id
LEFT JOIN public.store_racks dr             ON dr.id = i.default_rack
WHERE i.is_active = true
GROUP BY i.id, i.item_code, i.item_name, i.category, i.sub_category,
         i.unit, i.is_asset, i.default_rack, dr.rack_code, dr.rack_name;

GRANT SELECT ON public.store_current_stock_by_item TO authenticated;
GRANT SELECT ON public.store_current_stock_by_item TO service_role;
