/*
  # Add Floor to Product Masters

  1. Changes
    - Add `floor` column to `product_masters` table
      - `floor` (uuid, foreign key to floors table)
      - Allows NULL (optional field)
    
  2. Purpose
    - Track the default floor location for each product master
    - Helps with inventory organization and placement
    - Every item can be assigned to a specific floor in the store
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_masters' AND column_name = 'floor'
  ) THEN
    ALTER TABLE product_masters ADD COLUMN floor uuid REFERENCES floors(id);
  END IF;
END $$;
