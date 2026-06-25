-- =====================================================================
-- Stock Ledger
-- =====================================================================
-- Read-only view over store_stock_transactions. Single source of truth
-- for every inventory movement. Includes running balance per item using
-- a window function. Never insert/update through this view.
-- =====================================================================

-- Optional department column for future-proof issuance metadata.
ALTER TABLE public.store_stock_transactions
    ADD COLUMN IF NOT EXISTS department text;

-- Helpful composite index for chronological running-balance scans.
CREATE INDEX IF NOT EXISTS idx_store_txn_item_chrono
    ON public.store_stock_transactions(item_id, transaction_date, created_at);

CREATE OR REPLACE VIEW public.store_stock_ledger AS
SELECT
    t.id,
    t.transaction_number,
    t.transaction_date,
    t.transaction_type,
    t.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit                                                          AS item_unit,
    i.is_asset,
    t.quantity,
    GREATEST(t.quantity, 0)::numeric(18,4)                          AS qty_in,
    GREATEST(-t.quantity, 0)::numeric(18,4)                         AS qty_out,
    t.unit,
    t.rack_id,
    r.rack_code,
    r.rack_name,
    t.reference_type,
    t.reference_number,
    t.person,
    t.supplier,
    t.department,
    t.remarks,
    t.created_by,
    t.created_at,
    -- Running balance per item across the full history (chronological).
    SUM(t.quantity) OVER (
        PARTITION BY t.item_id
        ORDER BY t.transaction_date, t.created_at, t.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::numeric(18,4) AS running_balance
FROM public.store_stock_transactions t
JOIN public.store_items i ON i.id = t.item_id
LEFT JOIN public.store_racks r ON r.id = t.rack_id;

GRANT SELECT ON public.store_stock_ledger TO authenticated;
GRANT SELECT ON public.store_stock_ledger TO service_role;
