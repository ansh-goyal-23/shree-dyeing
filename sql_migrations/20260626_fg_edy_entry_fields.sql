-- Add explicit entry fields for Finished Goods and External Dyed Yarn receipts.
-- Finished Goods Entry: Date, Lot No, Shade No, No. of Cones, Gross Weight, Rack, Remarks
-- EDY Entry: Challan Date, Dyer, Lot No, Shade No, No. of Cones, Gross Weight, Rack, Remarks, Challan PDF

ALTER TABLE public.store_finished_goods_receipts
  ADD COLUMN IF NOT EXISTS cone_count integer,
  ADD COLUMN IF NOT EXISTS gross_weight numeric(14,3);

ALTER TABLE public.store_external_dyed_yarn_receipts
  ADD COLUMN IF NOT EXISTS lot_no text,
  ADD COLUMN IF NOT EXISTS shade_number text,
  ADD COLUMN IF NOT EXISTS cone_count integer,
  ADD COLUMN IF NOT EXISTS gross_weight numeric(14,3),
  ADD COLUMN IF NOT EXISTS challan_pdf_url text,
  ADD COLUMN IF NOT EXISTS challan_pdf_path text;
