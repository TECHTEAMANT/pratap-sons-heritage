-- Add hsn_code to product_masters
ALTER TABLE product_masters 
ADD COLUMN IF NOT EXISTS hsn_code text;
