-- =====================================================================
-- External Dyed Yarn Receipts (receipt-based, mirrors Finished Goods)
-- =====================================================================
-- Each external dyed yarn receipt becomes:
--   1. A row in store_external_dyed_yarn_receipts (header).
--   2. An auto-managed row in store_items (category=external_dyed_yarn,
--      item_code='EDY-<receipt_number>') unique per receipt.
--   3. A positive store_stock_transactions row
--      (type=external_dyed_yarn_receipt, ref_type='edy_receipt').
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.store_external_dyed_yarn_receipts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number  text NOT NULL UNIQUE,
    receipt_date    date NOT NULL DEFAULT CURRENT_DATE,
    supplier        text,
    challan_number  text,
    yarn_type       text,
    shade           text,
    net_weight      numeric(18, 4) NOT NULL,
    rate            numeric(18, 4),
    amount          numeric(18, 4),
    rack_id         uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    item_id         uuid REFERENCES public.store_items(id) ON DELETE SET NULL,
    remarks         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_external_dyed_yarn_receipts TO authenticated;
GRANT ALL ON public.store_external_dyed_yarn_receipts TO service_role;

ALTER TABLE public.store_external_dyed_yarn_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_edy_read" ON public.store_external_dyed_yarn_receipts;
CREATE POLICY "store_edy_read" ON public.store_external_dyed_yarn_receipts
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_edy_write" ON public.store_external_dyed_yarn_receipts;
CREATE POLICY "store_edy_write" ON public.store_external_dyed_yarn_receipts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_edy_date     ON public.store_external_dyed_yarn_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_edy_supplier ON public.store_external_dyed_yarn_receipts(supplier);
CREATE INDEX IF NOT EXISTS idx_store_edy_shade    ON public.store_external_dyed_yarn_receipts(shade);

-- Receipt number generator: EDY-YYYYMMDD-#####
CREATE SEQUENCE IF NOT EXISTS public.store_edy_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_edy_number()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
    SELECT 'EDY-' || to_char(now(), 'YYYYMMDD') || '-' ||
           lpad(nextval('public.store_edy_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_edy_number() TO authenticated;

DROP TRIGGER IF EXISTS trg_store_edy_updated_at ON public.store_external_dyed_yarn_receipts;
CREATE TRIGGER trg_store_edy_updated_at
    BEFORE UPDATE ON public.store_external_dyed_yarn_receipts
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- ---------- EDY Current Stock view (receipt-based) --------------------
CREATE OR REPLACE VIEW public.store_edy_current_stock AS
SELECT
    edy.id                AS receipt_id,
    edy.receipt_number,
    edy.receipt_date,
    edy.supplier,
    edy.challan_number,
    edy.yarn_type,
    edy.shade,
    edy.net_weight        AS received_weight,
    edy.rate,
    edy.amount,
    edy.rack_id,
    r.rack_code,
    r.rack_name,
    edy.item_id,
    i.item_code,
    i.unit,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_balance
FROM public.store_external_dyed_yarn_receipts edy
LEFT JOIN public.store_items i ON i.id = edy.item_id
LEFT JOIN public.store_racks r ON r.id = edy.rack_id
LEFT JOIN public.store_stock_transactions t ON t.item_id = edy.item_id
GROUP BY edy.id, edy.receipt_number, edy.receipt_date, edy.supplier,
         edy.challan_number, edy.yarn_type, edy.shade, edy.net_weight,
         edy.rate, edy.amount, edy.rack_id, r.rack_code, r.rack_name,
         edy.item_id, i.item_code, i.unit;

GRANT SELECT ON public.store_edy_current_stock TO authenticated;
GRANT SELECT ON public.store_edy_current_stock TO service_role;
