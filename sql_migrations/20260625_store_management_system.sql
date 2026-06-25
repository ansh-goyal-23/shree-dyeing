-- =====================================================================
-- Store Management System (Inventory v2) - Complete Redesign
-- =====================================================================
-- Philosophy: Inventory ONLY changes via explicit stock transactions.
-- Independent of Lots, Recipes, Expenses, Purchases.
-- Current stock is always derived (SUM) from stock_transactions.
-- =====================================================================

-- ---------- ENUMS -----------------------------------------------------

DO $$ BEGIN
    CREATE TYPE public.store_item_category AS ENUM (
        'raw_material',
        'office_utility',
        'tool_equipment',
        'finished_good',
        'external_dyed_yarn'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.store_raw_subcategory AS ENUM (
        'grey_yarn',
        'dye',
        'chemical',
        'oil',
        'paper_tube',
        'packaging_material'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.store_transaction_type AS ENUM (
        'stock_in',
        'internal_issue',
        'finished_lot_receipt',
        'external_dyed_yarn_receipt',
        'challan_dispatch',
        'stock_adjustment',
        'asset_issue',
        'asset_return'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- RACK MASTER -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_racks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_code    text NOT NULL UNIQUE,
    rack_name    text NOT NULL,
    area         text,
    description  text,
    is_active    boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_racks TO authenticated;
GRANT ALL ON public.store_racks TO service_role;

ALTER TABLE public.store_racks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_racks_read" ON public.store_racks;
CREATE POLICY "store_racks_read" ON public.store_racks
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_racks_write" ON public.store_racks;
CREATE POLICY "store_racks_write" ON public.store_racks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_racks_active ON public.store_racks(is_active);

-- ---------- ITEM MASTER -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code     text NOT NULL UNIQUE,
    item_name     text NOT NULL,
    category      public.store_item_category NOT NULL,
    sub_category  text, -- free text; for raw_material use store_raw_subcategory values
    unit          text NOT NULL,           -- kg, g, ltr, pcs, mtr, etc.
    is_asset      boolean NOT NULL DEFAULT false,
    is_active     boolean NOT NULL DEFAULT true,
    default_rack  uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    remarks       text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_items TO authenticated;
GRANT ALL ON public.store_items TO service_role;

ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_items_read" ON public.store_items;
CREATE POLICY "store_items_read" ON public.store_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_items_write" ON public.store_items;
CREATE POLICY "store_items_write" ON public.store_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_items_category    ON public.store_items(category);
CREATE INDEX IF NOT EXISTS idx_store_items_subcategory ON public.store_items(sub_category);
CREATE INDEX IF NOT EXISTS idx_store_items_active      ON public.store_items(is_active);
CREATE INDEX IF NOT EXISTS idx_store_items_name        ON public.store_items(item_name);

-- ---------- STOCK TRANSACTIONS ----------------------------------------
-- THE ONLY source of truth for stock movement.

CREATE TABLE IF NOT EXISTS public.store_stock_transactions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number text NOT NULL UNIQUE,
    transaction_date   date NOT NULL DEFAULT CURRENT_DATE,
    transaction_type   public.store_transaction_type NOT NULL,
    item_id            uuid NOT NULL REFERENCES public.store_items(id) ON DELETE RESTRICT,
    -- Signed quantity: positive = inflow, negative = outflow.
    -- App layer is responsible for the sign based on transaction_type.
    quantity           numeric(18, 4) NOT NULL,
    unit               text NOT NULL,
    rack_id            uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    reference_type     text,   -- e.g. 'lot', 'challan', 'manual', 'expense'
    reference_number   text,   -- free-form reference id / number
    person             text,   -- person issuing/receiving (internal)
    supplier           text,   -- supplier name for stock_in
    remarks            text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    created_by         uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_stock_transactions TO authenticated;
GRANT ALL ON public.store_stock_transactions TO service_role;

ALTER TABLE public.store_stock_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_txn_read" ON public.store_stock_transactions;
CREATE POLICY "store_txn_read" ON public.store_stock_transactions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_txn_write" ON public.store_stock_transactions;
CREATE POLICY "store_txn_write" ON public.store_stock_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_txn_item       ON public.store_stock_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_store_txn_date       ON public.store_stock_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_txn_type       ON public.store_stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_store_txn_rack       ON public.store_stock_transactions(rack_id);
CREATE INDEX IF NOT EXISTS idx_store_txn_item_rack  ON public.store_stock_transactions(item_id, rack_id);
CREATE INDEX IF NOT EXISTS idx_store_txn_reference  ON public.store_stock_transactions(reference_type, reference_number);

-- ---------- CURRENT STOCK VIEW (derived) ------------------------------

CREATE OR REPLACE VIEW public.store_current_stock AS
SELECT
    i.id                 AS item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    i.unit,
    i.is_asset,
    t.rack_id,
    r.rack_code,
    r.rack_name,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_quantity
FROM public.store_items i
LEFT JOIN public.store_stock_transactions t ON t.item_id = i.id
LEFT JOIN public.store_racks r ON r.id = t.rack_id
WHERE i.is_active = true
GROUP BY i.id, i.item_code, i.item_name, i.category, i.sub_category,
         i.unit, i.is_asset, t.rack_id, r.rack_code, r.rack_name;

GRANT SELECT ON public.store_current_stock TO authenticated;
GRANT SELECT ON public.store_current_stock TO service_role;

-- ---------- TRANSACTION NUMBER GENERATOR ------------------------------

CREATE SEQUENCE IF NOT EXISTS public.store_txn_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_txn_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'STX-' || to_char(now(), 'YYYYMMDD') || '-' ||
           lpad(nextval('public.store_txn_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_txn_number() TO authenticated;

-- ---------- updated_at TRIGGER ----------------------------------------

CREATE OR REPLACE FUNCTION public.tg_store_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_store_items_updated_at ON public.store_items;
CREATE TRIGGER trg_store_items_updated_at
    BEFORE UPDATE ON public.store_items
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

DROP TRIGGER IF EXISTS trg_store_racks_updated_at ON public.store_racks;
CREATE TRIGGER trg_store_racks_updated_at
    BEFORE UPDATE ON public.store_racks
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();
