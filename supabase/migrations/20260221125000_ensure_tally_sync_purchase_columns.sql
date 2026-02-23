/*
  # Ensure tally_sync table has purchase support columns

  This migration is safe to run even if already applied (uses IF NOT EXISTS / DO blocks).
  
  1. Changes
     - Add `sync_type` column (defaults to 'sales') if not present
     - Add `purchase_order_id` column (nullable FK to purchase_orders) if not present
     - Make `invoice_id` column nullable if it isn't already
     - Add CHECK constraint ensuring correct reference per sync type (if not present)
     - Add index on sync_type for performance (if not present)
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

-- Make invoice_id nullable (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tally_sync' AND column_name = 'invoice_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tally_sync ALTER COLUMN invoice_id DROP NOT NULL;
  END IF;
END $$;

-- Add check constraint (if not exists)
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

-- Create index on sync_type if not exists
CREATE INDEX IF NOT EXISTS idx_tally_sync_type ON tally_sync(sync_type);
