-- =====================================================================
-- Stock Inward (GRN) header + rate/amount tracking on transactions
-- =====================================================================

-- Add optional pricing columns to the transactions table.
ALTER TABLE public.store_stock_transactions
    ADD COLUMN IF NOT EXISTS rate   numeric(18, 4),
    ADD COLUMN IF NOT EXISTS amount numeric(18, 4);

-- Inward header table. Lines live in store_stock_transactions, linked via
-- reference_type = 'stock_inward' and reference_number = inward_number.
CREATE TABLE IF NOT EXISTS public.store_stock_inward (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inward_number   text NOT NULL UNIQUE,
    inward_date     date NOT NULL DEFAULT CURRENT_DATE,
    supplier        text,
    invoice_number  text,
    grn_number      text,
    remarks         text,
    total_amount    numeric(18, 4) NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_stock_inward TO authenticated;
GRANT ALL ON public.store_stock_inward TO service_role;

ALTER TABLE public.store_stock_inward ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_inward_read" ON public.store_stock_inward;
CREATE POLICY "store_inward_read" ON public.store_stock_inward
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_inward_write" ON public.store_stock_inward;
CREATE POLICY "store_inward_write" ON public.store_stock_inward
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_inward_date     ON public.store_stock_inward(inward_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_inward_supplier ON public.store_stock_inward(supplier);

-- Inward number generator: GRN-YYYYMMDD-#####
CREATE SEQUENCE IF NOT EXISTS public.store_inward_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_inward_number()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
    SELECT 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' ||
           lpad(nextval('public.store_inward_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_inward_number() TO authenticated;
