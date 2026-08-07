-- =====================================================================
-- Fix: store_stock_inward missing bill_url / bill_path columns
-- Additive only. Safe to run multiple times.
-- =====================================================================

ALTER TABLE public.store_stock_inward
    ADD COLUMN IF NOT EXISTS bill_url  text,
    ADD COLUMN IF NOT EXISTS bill_path text;

-- Storage bucket for invoice/bill attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('inward-bills', 'inward-bills', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "inward_bills_read" ON storage.objects;
CREATE POLICY "inward_bills_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'inward-bills');

DROP POLICY IF EXISTS "inward_bills_write" ON storage.objects;
CREATE POLICY "inward_bills_write" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'inward-bills');

DROP POLICY IF EXISTS "inward_bills_update" ON storage.objects;
CREATE POLICY "inward_bills_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'inward-bills');

DROP POLICY IF EXISTS "inward_bills_delete" ON storage.objects;
CREATE POLICY "inward_bills_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'inward-bills');

-- Refresh the PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
