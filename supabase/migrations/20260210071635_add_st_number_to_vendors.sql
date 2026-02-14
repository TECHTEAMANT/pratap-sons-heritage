/*
  # Add ST Number to Vendors

  1. Changes
    - Add `st_number` column to `vendors` table for storing Sales Tax number
    
  2. Notes
    - ST Number is optional and stored as text
    - No default value required
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'st_number'
  ) THEN
    ALTER TABLE vendors ADD COLUMN st_number text;
  END IF;
END $$;
