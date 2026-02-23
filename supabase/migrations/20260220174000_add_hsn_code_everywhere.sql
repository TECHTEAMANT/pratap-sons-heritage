-- Add hsn_code to barcode_batches
ALTER TABLE barcode_batches 
ADD COLUMN IF NOT EXISTS hsn_code text;

-- Add hsn_code to purchase_items
ALTER TABLE purchase_items 
ADD COLUMN IF NOT EXISTS hsn_code text;
