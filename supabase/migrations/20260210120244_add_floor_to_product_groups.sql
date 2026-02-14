/*
  # Add Floor to Product Groups
  
  1. Changes
    - Add `floor_id` column to `product_groups` table
    - Create foreign key relationship to `floors` table
    - Floor will be stored at product group level instead of individual item level
    - This allows automatic floor assignment when creating inventory via purchases
  
  2. Migration Details
    - Adds nullable `floor_id` field (nullable to support existing records)
    - Creates index on `floor_id` for performance
    - Maintains referential integrity with foreign key constraint
*/

-- Add floor_id column to product_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_groups' AND column_name = 'floor_id'
  ) THEN
    ALTER TABLE product_groups ADD COLUMN floor_id uuid REFERENCES floors(id);
  END IF;
END $$;

-- Create index on floor_id for performance
CREATE INDEX IF NOT EXISTS idx_product_groups_floor ON product_groups(floor_id);
