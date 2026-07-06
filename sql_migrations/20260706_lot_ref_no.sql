-- Add optional Ref. No. field to lots
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS ref_no text;
