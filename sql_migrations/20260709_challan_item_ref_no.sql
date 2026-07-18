-- Add optional Ref. No. field to challan_items (auto-filled from lot on selection)
ALTER TABLE public.challan_items ADD COLUMN IF NOT EXISTS ref_no text;
