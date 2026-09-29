-- 20260929_raw_material_stock_staging.sql
--
-- Staging-schema companion to 20260929_raw_material_stock.sql. Same new
-- Raw Material Stock system, fully re-qualified to the `staging` schema so
-- it can be built/tested immediately on the staging site. See
-- 20260929_raw_material_stock.sql for full design-decision commentary --
-- not repeated here to avoid drift between the two copies.
--
-- Note: raw_material_category / raw_material_txn_type are plain ENUM types
-- (not schema-specific), so they're shared across public and staging just
-- like every other enum in this database -- only created once, by whichever
-- of the two files runs first.
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

CREATE TABLE IF NOT EXISTS staging.raw_materials (
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

GRANT SELECT, INSERT, UPDATE, DELETE ON staging.raw_materials TO authenticated;
GRANT ALL ON staging.raw_materials TO service_role;

ALTER TABLE staging.raw_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raw_materials_read" ON staging.raw_materials;
CREATE POLICY "raw_materials_read" ON staging.raw_materials
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "raw_materials_write" ON staging.raw_materials;
CREATE POLICY "raw_materials_write" ON staging.raw_materials
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON staging.raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active   ON staging.raw_materials(is_active);

DROP TRIGGER IF EXISTS trg_raw_materials_updated_at ON staging.raw_materials;
CREATE TRIGGER trg_raw_materials_updated_at
    BEFORE UPDATE ON staging.raw_materials
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

CREATE TABLE IF NOT EXISTS staging.raw_material_transactions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id       uuid NOT NULL REFERENCES staging.raw_materials(id) ON DELETE RESTRICT,
    transaction_type  public.raw_material_txn_type NOT NULL,
    quantity          numeric(18,4) NOT NULL,
    issued_to         text,
    remarks           text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON staging.raw_material_transactions TO authenticated;
GRANT ALL ON staging.raw_material_transactions TO service_role;

ALTER TABLE staging.raw_material_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raw_material_transactions_read" ON staging.raw_material_transactions;
CREATE POLICY "raw_material_transactions_read" ON staging.raw_material_transactions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "raw_material_transactions_write" ON staging.raw_material_transactions;
CREATE POLICY "raw_material_transactions_write" ON staging.raw_material_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_raw_material_txn_material ON staging.raw_material_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_raw_material_txn_date     ON staging.raw_material_transactions(created_at DESC);

CREATE OR REPLACE VIEW staging.raw_materials_with_stock AS
SELECT
    m.id, m.category, m.brand, m.supplier, m.spec_name, m.denier_count,
    m.unit, m.is_active, m.remarks, m.created_at,
    COALESCE(SUM(t.quantity), 0)::numeric(18,4) AS current_quantity
FROM staging.raw_materials m
LEFT JOIN staging.raw_material_transactions t ON t.material_id = m.id
WHERE m.is_active = true
GROUP BY m.id, m.category, m.brand, m.supplier, m.spec_name, m.denier_count,
         m.unit, m.is_active, m.remarks, m.created_at;

GRANT SELECT ON staging.raw_materials_with_stock TO authenticated;
GRANT SELECT ON staging.raw_materials_with_stock TO service_role;
