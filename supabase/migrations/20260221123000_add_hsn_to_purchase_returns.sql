-- Add hsn_code to purchase_return_items
ALTER TABLE purchase_return_items 
ADD COLUMN IF NOT EXISTS hsn_code text;
