/*
  # Add order_number column to purchase_orders table

  1. Changes
    - Add `order_number` column to `purchase_orders` table
      - Type: text
      - Nullable: true (for backward compatibility with existing records)
      - Description: Stores the vendor's order number or reference number
  
  2. Notes
    - This column will store the order number from the vendor side
    - Distinct from po_number which is generated internally
    - Can be used for cross-referencing with vendor invoices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN order_number text;
  END IF;
END $$;
