-- =====================================================================
-- Store Stock Verification (Physical Stock Count)
-- =====================================================================
-- Monthly physical counting. Session captures a snapshot of calculated
-- stock per item, manager records physical quantity, and on approval
-- the system creates `stock_adjustment` transactions for every line
-- whose difference (physical - system) is non-zero.
-- Stock is NEVER edited directly — only via transactions.
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE public.store_verification_status AS ENUM (
        'draft',
        'approved',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- SESSIONS --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_verification_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number  text NOT NULL UNIQUE,
    session_date    date NOT NULL DEFAULT CURRENT_DATE,
    title           text,
    status          public.store_verification_status NOT NULL DEFAULT 'draft',
    remarks         text,
    approved_at     timestamptz,
    approved_by     uuid REFERENCES auth.users(id),
    cancelled_at    timestamptz,
    cancelled_by    uuid REFERENCES auth.users(id),
    adjustment_count int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_verification_sessions TO authenticated;
GRANT ALL ON public.store_verification_sessions TO service_role;

ALTER TABLE public.store_verification_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svs_read"  ON public.store_verification_sessions;
CREATE POLICY "svs_read"  ON public.store_verification_sessions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "svs_write" ON public.store_verification_sessions;
CREATE POLICY "svs_write" ON public.store_verification_sessions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_svs_status ON public.store_verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_svs_date   ON public.store_verification_sessions(session_date DESC);

DROP TRIGGER IF EXISTS trg_svs_updated_at ON public.store_verification_sessions;
CREATE TRIGGER trg_svs_updated_at
    BEFORE UPDATE ON public.store_verification_sessions
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- ---------- LINES -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_verification_lines (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NOT NULL REFERENCES public.store_verification_sessions(id) ON DELETE CASCADE,
    item_id             uuid NOT NULL REFERENCES public.store_items(id) ON DELETE RESTRICT,
    unit                text NOT NULL,
    rack_id             uuid REFERENCES public.store_racks(id) ON DELETE SET NULL,
    -- snapshot of derived stock at the time the session was created
    system_quantity     numeric(18, 4) NOT NULL DEFAULT 0,
    -- entered by store manager (null until counted)
    physical_quantity   numeric(18, 4),
    remarks             text,
    -- populated on approval if difference != 0
    adjustment_txn_id   uuid REFERENCES public.store_stock_transactions(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_verification_lines TO authenticated;
GRANT ALL ON public.store_verification_lines TO service_role;

ALTER TABLE public.store_verification_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svl_read"  ON public.store_verification_lines;
CREATE POLICY "svl_read"  ON public.store_verification_lines
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "svl_write" ON public.store_verification_lines;
CREATE POLICY "svl_write" ON public.store_verification_lines
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_svl_session ON public.store_verification_lines(session_id);
CREATE INDEX IF NOT EXISTS idx_svl_item    ON public.store_verification_lines(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_svl_session_item ON public.store_verification_lines(session_id, item_id);

DROP TRIGGER IF EXISTS trg_svl_updated_at ON public.store_verification_lines;
CREATE TRIGGER trg_svl_updated_at
    BEFORE UPDATE ON public.store_verification_lines
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();

-- ---------- SESSION NUMBER GENERATOR ---------------------------------

CREATE SEQUENCE IF NOT EXISTS public.store_verification_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_verification_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'SVN-' || to_char(now(), 'YYYYMMDD') || '-' ||
           lpad(nextval('public.store_verification_seq')::text, 4, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_verification_number() TO authenticated;

-- ---------- LINE-DETAIL VIEW (joins items + racks) -------------------

CREATE OR REPLACE VIEW public.store_verification_lines_view AS
SELECT
    l.id,
    l.session_id,
    l.item_id,
    i.item_code,
    i.item_name,
    i.category,
    i.sub_category,
    l.unit,
    l.rack_id,
    r.rack_code,
    r.rack_name,
    l.system_quantity,
    l.physical_quantity,
    CASE WHEN l.physical_quantity IS NULL THEN NULL
         ELSE (l.physical_quantity - l.system_quantity)::numeric(18,4)
    END AS difference,
    l.remarks,
    l.adjustment_txn_id,
    l.created_at,
    l.updated_at
FROM public.store_verification_lines l
JOIN public.store_items i ON i.id = l.item_id
LEFT JOIN public.store_racks r ON r.id = l.rack_id;

GRANT SELECT ON public.store_verification_lines_view TO authenticated;
GRANT SELECT ON public.store_verification_lines_view TO service_role;
