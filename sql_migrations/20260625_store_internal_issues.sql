-- =====================================================================
-- Internal Issues (Store -> Factory Department)
-- =====================================================================
-- Adds a `purpose` column to transactions (per-line use case).
-- Header table: store_internal_issues. Lines live in
-- store_stock_transactions with reference_type = 'internal_issue'.
-- Stock is NEVER directly modified; on edit we insert reversal
-- transactions for the previous lines, then insert new ones.
-- =====================================================================

ALTER TABLE public.store_stock_transactions
    ADD COLUMN IF NOT EXISTS purpose text;

CREATE TABLE IF NOT EXISTS public.store_internal_issues (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number  text NOT NULL UNIQUE,
    issue_date    date NOT NULL DEFAULT CURRENT_DATE,
    department    text,
    issued_to     text,
    remarks       text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_internal_issues TO authenticated;
GRANT ALL ON public.store_internal_issues TO service_role;

ALTER TABLE public.store_internal_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_issue_read" ON public.store_internal_issues;
CREATE POLICY "store_issue_read" ON public.store_internal_issues
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_issue_write" ON public.store_internal_issues;
CREATE POLICY "store_issue_write" ON public.store_internal_issues
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_store_issue_date       ON public.store_internal_issues(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_issue_department ON public.store_internal_issues(department);

-- Issue number generator: ISS-YYYYMMDD-#####
CREATE SEQUENCE IF NOT EXISTS public.store_issue_seq START 1;

CREATE OR REPLACE FUNCTION public.next_store_issue_number()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
    SELECT 'ISS-' || to_char(now(), 'YYYYMMDD') || '-' ||
           lpad(nextval('public.store_issue_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_store_issue_number() TO authenticated;

DROP TRIGGER IF EXISTS trg_store_issue_updated_at ON public.store_internal_issues;
CREATE TRIGGER trg_store_issue_updated_at
    BEFORE UPDATE ON public.store_internal_issues
    FOR EACH ROW EXECUTE FUNCTION public.tg_store_set_updated_at();
