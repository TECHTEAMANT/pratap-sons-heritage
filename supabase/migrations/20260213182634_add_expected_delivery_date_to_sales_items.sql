/*
  # Add Expected Delivery Date to Sales Invoice Items

  ## Changes
  - Add `expected_delivery_date` (date) field to `sales_invoice_items` table
    - This field stores the expected delivery date for items not delivered immediately
    - Helps track when items are scheduled for delivery
  
  ## Notes
  - Field is nullable (items delivered immediately won't have this)
  - No default value since it's only set when item is not delivered
  
  ## Security
  - No RLS changes needed (existing policies apply)
*/

-- Add expected_delivery_date to sales_invoice_items
ALTER TABLE sales_invoice_items 
ADD COLUMN IF NOT EXISTS expected_delivery_date date;

-- Create index for faster queries on expected delivery dates
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_expected_delivery 
ON sales_invoice_items(expected_delivery_date) 
WHERE expected_delivery_date IS NOT NULL;
