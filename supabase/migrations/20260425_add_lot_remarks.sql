-- Add free-form remarks column to lots for reference notes
ALTER TABLE lots ADD COLUMN IF NOT EXISTS remarks text;
