-- =====================================================================
-- Unify Finished Goods + External Dyed Yarn receipts into one table.
-- =====================================================================
-- Both tables shared ~90% of their columns. The single table
-- store_yarn_receipts distinguishes the two via the `source` enum.
-- The two old views (store_fg_current_stock, store_edy_current_stock)
-- are replaced by store_yarn_receipt_stock.
-- Also collapses net_weight + gross_weight into a single received_weight
-- column (they were always set to the same value).
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE public.store_yarn_receipt_source AS ENUM (
        'finished_goods',
        'external_dyed_yarn'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.store_yarn_receipts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number   text NOT NULL UNIQUE,
    receipt_date     date NOT NULL DEFAULT CURRENT_DATE,
    source           public.store_yarn_receipt_source NOT NULL,

    lot_no           text,            -- required for finished_goods, optional for EDY
    shade            text,
    shade_number     text,
    yarn_type        text,

    -- finished_goods only
    client           text,

    -- external_dyed_yarn only
    supplier         text,
    challan_number   text,
    challan_pdf_url  text,
    challan_pdf_path text,
    rate             numeric(18, 4),
    amount           numeric(18, 4),

    cone_count       integer,
    received_weight  numeric(18, 4) NOT NULL,

    rack_id          uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    item_id          uuid REFERENCES public.store_items(id) ON DELETE SET NULL,
    remarks          text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Finished goods: one receipt per lot. EDY: lot can repeat / be null.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_yarn_receipts_fg_lot
    ON public.store_yarn_receipts(lot_no)
    WHERE source = 'finished_goods';

CREATE INDEX IF NOT EXISTS idx_store_yarn_receipts_source   ON public.store_yarn_receipts(source);
CREATE INDEX IF NOT EXISTS idx_store_yarn_receipts_date     ON public.store_yarn_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_yarn_receipts_supplier ON public.store_yarn_receipts(supplier);
CREATE INDEX IF NOT EXISTS idx_store_yarn_receipts_client   ON public.store_yarn_receipts(client);
CREATE INDEX IF NOT EXISTS idx_store_yarn_receipts_lot      ON public.store_yarn_receipts(lot_no);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_yarn_receipts TO authenticated;
GRANT ALL ON public.store_yarn_receipts TO service_role;

ALTER TABLE public.store_yarn_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_yarn_receipts_read" ON public.store_yarn_receipts;
CREATE POLICY "store_yarn_receipts_read" ON public.store_yarn_receipts
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "store_yarn_receipts_write" ON public.store_yarn_receipts;
CREATE POLICY "store_yarn_receipts_write" ON public.store_yarn_receipts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_store_yarn_receipts_updated_at ON public.store_yarn_receipts;
CREATE TRIGGER trg_store_yarn_receipts_updated_at
    BEFORE UPDATE ON public.store_yarn_receipts
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- ---------- Migrate existing data ------------------------------------

INSERT INTO public.store_yarn_receipts (
    id, receipt_number, receipt_date, source,
    lot_no, shade, shade_number, yarn_type, client,
    cone_count, received_weight,
    rack_id, item_id, remarks, created_at, updated_at, created_by
)
SELECT
    fg.id, fg.receipt_number, fg.receipt_date, 'finished_goods'::public.store_yarn_receipt_source,
    fg.lot_no, fg.shade, NULL, fg.yarn_type, fg.client,
    fg.cone_count, COALESCE(fg.gross_weight, fg.net_weight),
    fg.rack_id, fg.item_id, fg.remarks, fg.created_at, fg.updated_at, fg.created_by
FROM public.store_finished_goods_receipts fg
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_yarn_receipts (
    id, receipt_number, receipt_date, source,
    lot_no, shade, shade_number, yarn_type,
    supplier, challan_number, challan_pdf_url, challan_pdf_path, rate, amount,
    cone_count, received_weight,
    rack_id, item_id, remarks, created_at, updated_at, created_by
)
SELECT
    edy.id, edy.receipt_number, edy.receipt_date, 'external_dyed_yarn'::public.store_yarn_receipt_source,
    edy.lot_no, edy.shade, edy.shade_number, edy.yarn_type,
    edy.supplier, edy.challan_number, edy.challan_pdf_url, edy.challan_pdf_path, edy.rate, edy.amount,
    edy.cone_count, COALESCE(edy.gross_weight, edy.net_weight),
    edy.rack_id, edy.item_id, edy.remarks, edy.created_at, edy.updated_at, edy.created_by
FROM public.store_external_dyed_yarn_receipts edy
ON CONFLICT (id) DO NOTHING;

-- ---------- Unified current-stock view -------------------------------
-- Replaces store_fg_current_stock and store_edy_current_stock.

DROP VIEW IF EXISTS public.store_fg_current_stock;
DROP VIEW IF EXISTS public.store_edy_current_stock;

CREATE OR REPLACE VIEW public.store_yarn_receipt_stock AS
SELECT
    yr.id                AS receipt_id,
    yr.receipt_number,
    yr.receipt_date,
    yr.source,
    yr.lot_no,
    yr.shade,
    yr.shade_number,
    yr.yarn_type,
    yr.client,
    yr.supplier,
    yr.challan_number,
    yr.challan_pdf_url,
    yr.cone_count,
    yr.received_weight,
    yr.rate,
    yr.amount,
    yr.rack_id,
    r.rack_code,
    r.rack_name,
    yr.item_id,
    i.item_code,
    i.unit,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_balance,
    l.status             AS lot_status
FROM public.store_yarn_receipts yr
LEFT JOIN public.store_items i ON i.id = yr.item_id
LEFT JOIN public.store_racks r ON r.id = yr.rack_id
LEFT JOIN public.store_stock_transactions t ON t.item_id = yr.item_id
LEFT JOIN public.lots l ON l.lot_no = yr.lot_no AND yr.source = 'finished_goods'
GROUP BY yr.id, yr.receipt_number, yr.receipt_date, yr.source, yr.lot_no,
         yr.shade, yr.shade_number, yr.yarn_type, yr.client, yr.supplier,
         yr.challan_number, yr.challan_pdf_url, yr.cone_count,
         yr.received_weight, yr.rate, yr.amount,
         yr.rack_id, r.rack_code, r.rack_name,
         yr.item_id, i.item_code, i.unit, l.status;

GRANT SELECT ON public.store_yarn_receipt_stock TO authenticated;
GRANT SELECT ON public.store_yarn_receipt_stock TO service_role;

-- ---------- Drop the old per-source tables ---------------------------
-- Data has been migrated above; transactions remain unchanged (they
-- referenced receipts by reference_number, not by FK).

DROP TABLE IF EXISTS public.store_finished_goods_receipts CASCADE;
DROP TABLE IF EXISTS public.store_external_dyed_yarn_receipts CASCADE;

-- The old number generators stay; they're still useful as
-- receipt-number sources (FG-* and EDY-*).
