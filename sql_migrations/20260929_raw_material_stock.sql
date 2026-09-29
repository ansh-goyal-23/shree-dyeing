-- 20260929_raw_material_stock.sql
--
-- New, standalone "Raw Material Stock" system (public schema) -- ships
-- later; also applied to `staging` right away in
-- 20260929_raw_material_stock_staging.sql so it can be built/tested there
-- first (see Software/Release-Status.md).
--
-- Design decisions confirmed with Ansh (2026-09-29):
--   - Deliberately NOT built on top of the existing Store Management v2
--     item/transaction tables (store_items/store_stock_transactions).
--     Those model a generic item_name/sub_category and already have a
--     heavier multi-line Internal Issue form; this feature needs specific
--     structured fields per material type (Brand, Yarn Type, Denier/Count
--     for Grey Yarn, etc.) and a single-click Issue popup. Kept standalone
--     so a future "auto-add from Expenses" integration doesn't need to
--     entangle with the generic Store item model.
--   - Current quantity is ALWAYS a derived SUM of transactions, never
--     stored directly -- the same principle used everywhere else in this
--     app (Store, Orders). Every Add and Issue is its own logged
--     transaction row, giving a free audit trail and making a future
--     auto-add-from-Expenses hook trivial (it just inserts another 'add'
--     transaction).
--   - Issuing more than the current stock shows is BLOCKED (enforced in
--     the app layer at mutation time, matching how other quantity guards
--     work in this codebase, e.g. challan payment amounts).
--   - History/ledger UI per material is deliberately deferred -- the
--     transactions table exists so nothing is lost, but no UI for it yet.
--
-- NOT YET RUN. Review, then run manually in the Supabase SQL editor.
-- SAFE / additive: only creates new objects, touches no existing table.

DO $$ BEGIN
    CREATE TYPE public.raw_material_category AS ENUM (
        'grey_yarn', 'chemical', 'color', 'packing_polythene', 'oil'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.raw_material_txn_type AS ENUM ('add', 'issue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- raw_materials: one row per distinct material ----------
-- Field meaning varies by category (app enforces which fields apply):
--   grey_yarn          -> brand, spec_name (Yarn Type), denier_count
--   chemical           -> brand, spec_name (Chemical Name)
--   color              -> brand, spec_name (Color Name)
--   packing_polythene  -> spec_name (Size Type)
--   oil                -> supplier

CREATE TABLE IF NOT EXISTS public.raw_materials (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category      public.raw_material_category NOT NULL,
    brand         text,
    supplier      text,
    spec_name     text,
    denier_count  text,
    unit          text NOT NULL DEFAULT 'kg',
    is_active     boolean NOT NULL DEFAULT true,
    remarks       text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_materials TO authenticated;
GRANT ALL ON public.raw_materials TO service_role;

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raw_materials_read" ON public.raw_materials;
CREATE POLICY "raw_materials_read" ON public.raw_materials
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "raw_materials_write" ON public.raw_materials;
CREATE POLICY "raw_materials_write" ON public.raw_materials
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON public.raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active   ON public.raw_materials(is_active);

DROP TRIGGER IF EXISTS trg_raw_materials_updated_at ON public.raw_materials;
CREATE TRIGGER trg_raw_materials_updated_at
    BEFORE UPDATE ON public.raw_materials
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- ---------- raw_material_transactions: the ONLY source of stock movement ----------
-- Signed quantity: positive = add (inflow), negative = issue (outflow).

CREATE TABLE IF NOT EXISTS public.raw_material_transactions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id       uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
    transaction_type  public.raw_material_txn_type NOT NULL,
    quantity          numeric(18,4) NOT NULL,
    issued_to         text,   -- issue only
    remarks           text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_material_transactions TO authenticated;
GRANT ALL ON public.raw_material_transactions TO service_role;

ALTER TABLE public.raw_material_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raw_material_transactions_read" ON public.raw_material_transactions;
CREATE POLICY "raw_material_transactions_read" ON public.raw_material_transactions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "raw_material_transactions_write" ON public.raw_material_transactions;
CREATE POLICY "raw_material_transactions_write" ON public.raw_material_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_raw_material_txn_material ON public.raw_material_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_raw_material_txn_date     ON public.raw_material_transactions(created_at DESC);

-- ---------- Current stock view (derived, never stored) ----------

CREATE OR REPLACE VIEW public.raw_materials_with_stock AS
SELECT
    m.id, m.category, m.brand, m.supplier, m.spec_name, m.denier_count,
    m.unit, m.is_active, m.remarks, m.created_at,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_quantity
FROM public.raw_materials m
LEFT JOIN public.raw_material_transactions t ON t.material_id = m.id
WHERE m.is_active = true
GROUP BY m.id, m.category, m.brand, m.supplier, m.spec_name, m.denier_count,
         m.unit, m.is_active, m.remarks, m.created_at;

GRANT SELECT ON public.raw_materials_with_stock TO authenticated;
GRANT SELECT ON public.raw_materials_with_stock TO service_role;
