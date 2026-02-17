/*
  # Add Birthday and Anniversary to Customers

  1. Changes
    - Add `birthday` (date)
    - Add `anniversary` (date)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'birthday'
  ) THEN
    ALTER TABLE customers ADD COLUMN birthday date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'anniversary'
  ) THEN
    ALTER TABLE customers ADD COLUMN anniversary date;
  END IF;
END $$;
