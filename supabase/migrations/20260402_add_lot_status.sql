-- Add status column to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'In Approval';

-- Migrate existing data
UPDATE lots SET status = 'Approved' WHERE is_approved = true;
UPDATE lots SET status = 'Production' WHERE is_approved = false AND shade_number IS NOT NULL AND shade_number != lot_no;
UPDATE lots SET status = 'In Approval' WHERE is_approved = false AND (shade_number IS NULL OR shade_number = lot_no);
