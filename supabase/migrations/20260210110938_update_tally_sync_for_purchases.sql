/*
  # Update Tally Sync for Purchase Invoices

  1. Changes to Tables
    - Add `sync_type` column to distinguish between 'sales' and 'purchase' invoices
    - Add `purchase_order_id` column as optional reference to purchase_orders
    - Make `invoice_id` nullable since purchase orders use different reference
    - Add index on sync_type for faster filtering
  
  2. Updates
    - Existing records will be marked as 'sales' type by default
*/

-- Add sync_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tally_sync' AND column_name = 'sync_type'
  ) THEN
    ALTER TABLE tally_sync ADD COLUMN sync_type text NOT NULL DEFAULT 'sales';
  END IF;
END $$;

-- Add purchase_order_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tally_sync' AND column_name = 'purchase_order_id'
  ) THEN
    ALTER TABLE tally_sync ADD COLUMN purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make invoice_id nullable
ALTER TABLE tally_sync ALTER COLUMN invoice_id DROP NOT NULL;

-- Create index on sync_type
CREATE INDEX IF NOT EXISTS idx_tally_sync_type ON tally_sync(sync_type);

-- Add check constraint to ensure either invoice_id or purchase_order_id is provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tally_sync_reference_check'
  ) THEN
    ALTER TABLE tally_sync ADD CONSTRAINT tally_sync_reference_check 
      CHECK (
        (sync_type = 'sales' AND invoice_id IS NOT NULL) OR
        (sync_type = 'purchase' AND purchase_order_id IS NOT NULL)
      );
  END IF;
END $$;
