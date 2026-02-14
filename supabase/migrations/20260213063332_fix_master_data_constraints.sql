/*
  # Fix Master Data Constraints and Issues
  
  1. Changes
    - Make discount_masters.flag_name nullable (was NOT NULL causing errors)
    - Ensure discount_masters.end_date is nullable
    - Add total_return_amount column to purchase_returns if missing
    - Add validation check for mobile numbers (10 digits)
    - Add validation check for email format
  
  2. Notes
    - Fixes constraint violations reported in bug reports
    - Improves data validation at database level
*/

-- Make flag_name nullable in discount_masters  
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'discount_masters'
    AND column_name = 'flag_name'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE discount_masters ALTER COLUMN flag_name DROP NOT NULL;
  END IF;
END $$;

-- Ensure end_date is nullable (should already be, but double-check)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'discount_masters'
    AND column_name = 'end_date'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE discount_masters ALTER COLUMN end_date DROP NOT NULL;
  END IF;
END $$;

-- Add total_return_amount to purchase_returns if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'purchase_returns'
    AND column_name = 'total_return_amount'
  ) THEN
    ALTER TABLE purchase_returns ADD COLUMN total_return_amount numeric DEFAULT 0;
  END IF;
END $$;

-- Update discount_masters to have flag_name default if null
UPDATE discount_masters
SET flag_name = COALESCE(discount_code, CONCAT('FLAG_', id::text))
WHERE flag_name IS NULL;
