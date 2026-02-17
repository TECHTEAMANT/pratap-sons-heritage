
-- Add print_quantity column to barcode_batches
ALTER TABLE barcode_batches 
ADD COLUMN IF NOT EXISTS print_quantity INTEGER DEFAULT 0;

-- Ensure other columns exist just in case (idempotent)
ALTER TABLE barcode_batches 
ADD COLUMN IF NOT EXISTS order_number text;

ALTER TABLE barcode_batches 
ADD COLUMN IF NOT EXISTS mrp_markup_percent numeric DEFAULT 100;

-- Make sure color is nullable (idempotent)
ALTER TABLE barcode_batches 
ALTER COLUMN color DROP NOT NULL;

-- Ensure product_masters has payout_code (from previous instruction)
ALTER TABLE product_masters 
ADD COLUMN IF NOT EXISTS payout_code text;

-- Ensure product_masters color is nullable (from previous instruction)
ALTER TABLE product_masters 
ALTER COLUMN color DROP NOT NULL;
