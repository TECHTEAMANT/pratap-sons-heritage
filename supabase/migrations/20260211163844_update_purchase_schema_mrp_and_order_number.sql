/*
  # Update Purchase Schema - MRP and Order Number Changes

  ## Changes Made
  
  1. Schema Updates:
    - Make MRP nullable in product_masters table
    - Add mrp_markup_percent column to purchase_items
    - Add order_number column to purchase_items  
    - Add mrp_markup_percent column to barcode_batches
    - Add order_number column to barcode_batches
    - Remove order_number column from purchase_orders
    - Remove expected_delivery_date column from purchase_orders
  
  2. Important Notes:
    - MRP is now calculated at purchase level with markup percentage
    - Each purchase item can have its own order number
    - Order numbers appear in barcodes for order-based inventory tracking
    - Expected delivery date removed as it's not required
*/

-- Make MRP nullable in product_masters
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_masters' AND column_name = 'mrp'
  ) THEN
    ALTER TABLE product_masters ALTER COLUMN mrp DROP NOT NULL;
  END IF;
END $$;

-- Add mrp_markup_percent to purchase_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'mrp_markup_percent'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN mrp_markup_percent numeric DEFAULT 100;
  END IF;
END $$;

-- Add order_number to purchase_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN order_number text;
  END IF;
END $$;

-- Add mrp_markup_percent to barcode_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'barcode_batches' AND column_name = 'mrp_markup_percent'
  ) THEN
    ALTER TABLE barcode_batches ADD COLUMN mrp_markup_percent numeric DEFAULT 100;
  END IF;
END $$;

-- Add order_number to barcode_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'barcode_batches' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE barcode_batches ADD COLUMN order_number text;
  END IF;
END $$;

-- Remove expected_delivery_date from purchase_orders if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'expected_delivery_date'
  ) THEN
    ALTER TABLE purchase_orders DROP COLUMN expected_delivery_date;
  END IF;
END $$;

-- Remove order_number from purchase_orders if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE purchase_orders DROP COLUMN order_number;
  END IF;
END $$;
