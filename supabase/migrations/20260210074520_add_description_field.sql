/*
  # Add Description Field to Items

  1. Changes to Tables
    - Add `description` column to `purchase_items` (text)
    - Add `description` column to `product_items` (text)
    - Add `item_name` column to `product_items` (text) - format: design_no-vendor_code
    
  2. Notes
    - Description field for additional item details
    - Item name follows format: DesignNo-VendorCode for easy identification
*/

-- Add description to purchase_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_items' AND column_name = 'description'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN description text DEFAULT '';
  END IF;
END $$;

-- Add description and item_name to product_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_items' AND column_name = 'description'
  ) THEN
    ALTER TABLE product_items ADD COLUMN description text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_items' AND column_name = 'item_name'
  ) THEN
    ALTER TABLE product_items ADD COLUMN item_name text;
  END IF;
END $$;

-- Create index for faster item_name searches
CREATE INDEX IF NOT EXISTS idx_product_items_item_name ON product_items(item_name);
