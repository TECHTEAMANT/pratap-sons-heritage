/*
  # Fix Master Data RLS Policies and Constraints

  1. Changes
    - Add INSERT, UPDATE, DELETE policies for vendors table
    - Add INSERT, UPDATE, DELETE policies for colors table
    - Add INSERT, UPDATE, DELETE policies for sizes table
    - Add INSERT, UPDATE, DELETE policies for product_groups table
    - Add INSERT, UPDATE, DELETE policies for floors table
    - Increase color_code field length from 2 to 10 characters
    
  2. Security
    - All policies restricted to authenticated users
    - Policies allow full CRUD operations for master data management
*/

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  -- Vendors policies
  DROP POLICY IF EXISTS "Authenticated users can insert vendors" ON vendors;
  DROP POLICY IF EXISTS "Authenticated users can update vendors" ON vendors;
  DROP POLICY IF EXISTS "Authenticated users can delete vendors" ON vendors;
  
  -- Colors policies
  DROP POLICY IF EXISTS "Authenticated users can insert colors" ON colors;
  DROP POLICY IF EXISTS "Authenticated users can update colors" ON colors;
  DROP POLICY IF EXISTS "Authenticated users can delete colors" ON colors;
  
  -- Sizes policies
  DROP POLICY IF EXISTS "Authenticated users can insert sizes" ON sizes;
  DROP POLICY IF EXISTS "Authenticated users can update sizes" ON sizes;
  DROP POLICY IF EXISTS "Authenticated users can delete sizes" ON sizes;
  
  -- Product groups policies
  DROP POLICY IF EXISTS "Authenticated users can insert product_groups" ON product_groups;
  DROP POLICY IF EXISTS "Authenticated users can update product_groups" ON product_groups;
  DROP POLICY IF EXISTS "Authenticated users can delete product_groups" ON product_groups;
  
  -- Floors policies
  DROP POLICY IF EXISTS "Authenticated users can insert floors" ON floors;
  DROP POLICY IF EXISTS "Authenticated users can update floors" ON floors;
  DROP POLICY IF EXISTS "Authenticated users can delete floors" ON floors;
END $$;

-- Create policies for vendors table
CREATE POLICY "Authenticated users can insert vendors"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendors"
  ON vendors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vendors"
  ON vendors FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for colors table
CREATE POLICY "Authenticated users can insert colors"
  ON colors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update colors"
  ON colors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete colors"
  ON colors FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for sizes table
CREATE POLICY "Authenticated users can insert sizes"
  ON sizes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sizes"
  ON sizes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sizes"
  ON sizes FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for product_groups table
CREATE POLICY "Authenticated users can insert product_groups"
  ON product_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product_groups"
  ON product_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete product_groups"
  ON product_groups FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for floors table
CREATE POLICY "Authenticated users can insert floors"
  ON floors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update floors"
  ON floors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete floors"
  ON floors FOR DELETE
  TO authenticated
  USING (true);

-- Increase color_code field length
ALTER TABLE colors ALTER COLUMN color_code TYPE VARCHAR(10);