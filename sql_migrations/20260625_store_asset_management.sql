-- =====================================================================
-- Asset Management
-- =====================================================================
-- Each physical asset is an individual unit linked to a store_items row
-- whose is_asset=true. Asset issue/return creates stock_transactions
-- (asset_issue = -1, asset_return = +1) and an asset_movements log.
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE public.store_asset_status AS ENUM (
        'available',
        'issued',
        'repair',
        'scrap'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.store_asset_movement_type AS ENUM (
        'issue',
        'return',
        'status_change'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ASSETS ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_assets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        text NOT NULL UNIQUE,
    item_id         uuid NOT NULL REFERENCES public.store_items(id) ON DELETE RESTRICT,
    current_holder  text,
    department      text,
    rack_id         uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    purchase_date   date,
    condition       text,
    status          public.store_asset_status NOT NULL DEFAULT 'available',
    remarks         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_assets TO authenticated;
GRANT ALL ON public.store_assets TO service_role;

ALTER TABLE public.store_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_assets_read" ON public.store_assets;
CREATE POLICY "store_assets_read" ON public.store_assets
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_assets_write" ON public.store_assets;
CREATE POLICY "store_assets_write" ON public.store_assets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_assets_item    ON public.store_assets(item_id);
CREATE INDEX IF NOT EXISTS idx_store_assets_status  ON public.store_assets(status);
CREATE INDEX IF NOT EXISTS idx_store_assets_holder  ON public.store_assets(current_holder);

DROP TRIGGER IF EXISTS trg_store_assets_updated_at ON public.store_assets;
CREATE TRIGGER trg_store_assets_updated_at
    BEFORE UPDATE ON public.store_assets
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- Asset ID generator: AST-#####
CREATE SEQUENCE IF NOT EXISTS public.store_asset_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_asset_id()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
    SELECT 'AST-' || lpad(nextval('public.store_asset_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_asset_id() TO authenticated;

-- ---------- ASSET MOVEMENT LOG ----------------------------------------

CREATE TABLE IF NOT EXISTS public.store_asset_movements (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id       uuid NOT NULL REFERENCES public.store_assets(id) ON DELETE CASCADE,
    movement_type  public.store_asset_movement_type NOT NULL,
    movement_date  date NOT NULL DEFAULT CURRENT_DATE,
    holder         text,
    department     text,
    rack_id        uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    condition      text,
    status_after   public.store_asset_status,
    remarks        text,
    transaction_id uuid REFERENCES public.store_stock_transactions(id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    created_by     uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_asset_movements TO authenticated;
GRANT ALL ON public.store_asset_movements TO service_role;

ALTER TABLE public.store_asset_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_asset_mv_read" ON public.store_asset_movements;
CREATE POLICY "store_asset_mv_read" ON public.store_asset_movements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_asset_mv_write" ON public.store_asset_movements;
CREATE POLICY "store_asset_mv_write" ON public.store_asset_movements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_asset_mv_asset ON public.store_asset_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_store_asset_mv_date  ON public.store_asset_movements(movement_date DESC);

-- ---------- ASSET DETAIL VIEW -----------------------------------------

CREATE OR REPLACE VIEW public.store_assets_view AS
SELECT
    a.id,
    a.asset_id,
    a.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    a.current_holder,
    a.department,
    a.rack_id,
    r.rack_code,
    r.rack_name,
    a.purchase_date,
    a.condition,
    a.status,
    a.remarks,
    a.created_at,
    a.updated_at
FROM public.store_assets a
JOIN public.store_items i ON i.id = a.item_id
LEFT JOIN public.store_racks r ON r.id = a.rack_id;

GRANT SELECT ON public.store_assets_view TO authenticated;
GRANT SELECT ON public.store_assets_view TO service_role;
