-- =====================================================================
-- Finished Goods Inventory (lot-based)
-- =====================================================================
-- Each finished production lot received into store becomes:
--   1. One row in store_finished_goods_receipts (header / metadata).
--   2. One auto-managed row in store_items (category=finished_good,
--      item_code = 'FG-<lot_no>', so the lot itself is the stock unit).
--   3. One positive stock_stock_transactions row
--      (type=finished_lot_receipt, ref_type='fg_receipt').
-- A lot can only be received ONCE (UNIQUE on lot_no).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.store_finished_goods_receipts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number  text NOT NULL UNIQUE,
    receipt_date    date NOT NULL DEFAULT CURRENT_DATE,
    lot_no          text NOT NULL UNIQUE,
    shade           text,
    client          text,
    yarn_type       text,
    net_weight      numeric(18, 4) NOT NULL,
    rack_id         uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    item_id         uuid REFERENCES public.store_items(id) ON DELETE SET NULL,
    remarks         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_finished_goods_receipts TO authenticated;
GRANT ALL ON public.store_finished_goods_receipts TO service_role;

ALTER TABLE public.store_finished_goods_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_fg_read" ON public.store_finished_goods_receipts;
CREATE POLICY "store_fg_read" ON public.store_finished_goods_receipts
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_fg_write" ON public.store_finished_goods_receipts;
CREATE POLICY "store_fg_write" ON public.store_finished_goods_receipts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_fg_date   ON public.store_finished_goods_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_fg_client ON public.store_finished_goods_receipts(client);
CREATE INDEX IF NOT EXISTS idx_store_fg_shade  ON public.store_finished_goods_receipts(shade);

-- Receipt number generator: FG-YYYYMMDD-#####
CREATE SEQUENCE IF NOT EXISTS public.store_fg_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_fg_number()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
    SELECT 'FG-' || to_char(now(), 'YYYYMMDD') || '-' ||
           lpad(nextval('public.store_fg_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_fg_number() TO authenticated;

DROP TRIGGER IF EXISTS trg_store_fg_updated_at ON public.store_finished_goods_receipts;
CREATE TRIGGER trg_store_fg_updated_at
    BEFORE UPDATE ON public.store_finished_goods_receipts
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- ---------- FG Current Stock view (lot-based) -------------------------
-- Joins the FG receipts header with the live sum of its stock txns and
-- the lot's status from the ERP lots table.
CREATE OR REPLACE VIEW public.store_fg_current_stock AS
SELECT
    fg.id                AS receipt_id,
    fg.receipt_number,
    fg.receipt_date,
    fg.lot_no,
    fg.shade,
    fg.client,
    fg.yarn_type,
    fg.net_weight        AS received_weight,
    fg.rack_id,
    r.rack_code,
    r.rack_name,
    fg.item_id,
    i.item_code,
    i.unit,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_balance,
    l.status             AS lot_status
FROM public.store_finished_goods_receipts fg
LEFT JOIN public.store_items i ON i.id = fg.item_id
LEFT JOIN public.store_racks r ON r.id = fg.rack_id
LEFT JOIN public.store_stock_transactions t ON t.item_id = fg.item_id
LEFT JOIN public.lots l ON l.lot_no = fg.lot_no
GROUP BY fg.id, fg.receipt_number, fg.receipt_date, fg.lot_no, fg.shade,
         fg.client, fg.yarn_type, fg.net_weight, fg.rack_id, r.rack_code,
         r.rack_name, fg.item_id, i.item_code, i.unit, l.status;

GRANT SELECT ON public.store_fg_current_stock TO authenticated;
GRANT SELECT ON public.store_fg_current_stock TO service_role;
