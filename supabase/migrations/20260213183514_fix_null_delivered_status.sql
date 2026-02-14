/*
  # Fix Null Delivery Status in Existing Items

  ## Changes
  - Update all sales_invoice_items with NULL delivered status to false
  - This ensures existing items that were created before the delivery tracking
    feature was added are properly marked as not delivered yet
  
  ## Notes
  - Only affects existing rows with NULL delivered status
  - New rows will continue to use the default value set on the column
  
  ## Security
  - No RLS changes needed
*/

-- Update existing items with null delivered status to false
UPDATE sales_invoice_items 
SET delivered = false 
WHERE delivered IS NULL;
