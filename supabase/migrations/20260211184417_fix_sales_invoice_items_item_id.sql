/*
  # Fix sales_invoice_items item_id constraint

  ## Changes
  1. Make item_id nullable in sales_invoice_items
    - The barcode_8digit field serves as the primary reference to the sold item
    - item_id foreign key constraint can remain but should be optional
  
  2. Security
    - No RLS changes needed
*/

-- Make item_id nullable since barcode_8digit is the primary reference
ALTER TABLE sales_invoice_items 
ALTER COLUMN item_id DROP NOT NULL;
