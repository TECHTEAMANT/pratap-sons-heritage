/*
  # Add 'Returned' Status to Product Items

  1. Changes
    - Add 'Returned' to the item_status enum type
    - This allows tracking items that have been returned to vendors
*/

-- Add 'Returned' status to the enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'Returned' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'item_status')
  ) THEN
    ALTER TYPE item_status ADD VALUE 'Returned';
  END IF;
END $$;
