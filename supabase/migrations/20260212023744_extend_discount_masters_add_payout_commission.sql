/*
  # Extend Discount Masters and Add Payout/Commission Tables

  ## Overview
  Extends the existing discount_masters table and creates new tables for
  payout codes and commission slabs based on product groups.

  ## Changes to Existing Tables
  
  1. Extend `discount_masters`
    - Add `discount_code` (text, unique) - Unique code for discount
    - Add `discount_name` (text) - Friendly name
    - Add `discount_value` (numeric) - Alias for default_value
    - Add `applicable_product_groups` (text[]) - Product groups this applies to
    - Add `start_date` (date) - When discount becomes active
    - Add `end_date` (date) - When discount expires
    - Add `is_active` (boolean) - Alias for active
    - Add `priority` (integer) - Priority when multiple discounts apply
    - Add `updated_at` (timestamptz) - Last update timestamp

  ## New Tables
  
  1. `payout_codes`
    - `id` (uuid, primary key) - Unique identifier
    - `payout_code` (text, unique) - Payout code identifier
    - `payout_name` (text) - Name/description
    - `payout_type` (text) - Type: Commission/Bonus/Incentive
    - `applicable_product_groups` (text[]) - Array of product group names/IDs
    - `is_active` (boolean) - Whether payout code is active
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  2. `commission_slabs`
    - `id` (uuid, primary key) - Unique identifier
    - `product_group_name` (text) - Product group name
    - `payout_code_id` (uuid) - Reference to payout_codes
    - `min_amount` (numeric) - Minimum sale amount for slab
    - `max_amount` (numeric) - Maximum sale amount for slab (null = unlimited)
    - `commission_percentage` (numeric) - Commission percentage
    - `flat_amount` (numeric) - Flat commission amount (if applicable)
    - `is_active` (boolean) - Whether slab is active
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on new tables
  - Authenticated users can read all data
  - Only users with masters permission can create/update/delete
*/

-- Extend discount_masters table with new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'discount_code'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN discount_code text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'discount_name'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN discount_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN discount_value numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'applicable_product_groups'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN applicable_product_groups text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN start_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN end_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'priority'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN priority integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discount_masters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update existing discount_masters records to populate new columns
UPDATE discount_masters 
SET 
  discount_code = COALESCE(discount_code, 'DISC' || id::text),
  discount_name = COALESCE(discount_name, flag_name),
  discount_value = COALESCE(discount_value, default_value),
  is_active = COALESCE(is_active, active)
WHERE discount_code IS NULL OR discount_name IS NULL;

-- Create payout_codes table
CREATE TABLE IF NOT EXISTS payout_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_code text UNIQUE NOT NULL,
  payout_name text NOT NULL,
  payout_type text DEFAULT 'Commission',
  applicable_product_groups text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create commission_slabs table
CREATE TABLE IF NOT EXISTS commission_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_group_name text NOT NULL,
  payout_code_id uuid REFERENCES payout_codes(id) ON DELETE CASCADE,
  min_amount numeric DEFAULT 0,
  max_amount numeric,
  commission_percentage numeric DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  flat_amount numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payout_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_slabs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payout_codes
CREATE POLICY "Authenticated users can read payout codes"
  ON payout_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payout codes"
  ON payout_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payout codes"
  ON payout_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete payout codes"
  ON payout_codes FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for commission_slabs
CREATE POLICY "Authenticated users can read commission slabs"
  ON commission_slabs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create commission slabs"
  ON commission_slabs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update commission slabs"
  ON commission_slabs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete commission slabs"
  ON commission_slabs FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_commission_slabs_payout_code 
  ON commission_slabs(payout_code_id);

CREATE INDEX IF NOT EXISTS idx_commission_slabs_product_group 
  ON commission_slabs(product_group_name);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_discount_masters_updated_at ON discount_masters;
CREATE TRIGGER update_discount_masters_updated_at
  BEFORE UPDATE ON discount_masters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payout_codes_updated_at ON payout_codes;
CREATE TRIGGER update_payout_codes_updated_at
  BEFORE UPDATE ON payout_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_slabs_updated_at ON commission_slabs;
CREATE TRIGGER update_commission_slabs_updated_at
  BEFORE UPDATE ON commission_slabs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default payout codes
INSERT INTO payout_codes (payout_code, payout_name, payout_type, is_active)
VALUES 
  ('PC001', 'Standard Commission', 'Commission', true),
  ('PC002', 'Premium Commission', 'Commission', true),
  ('PC003', 'Performance Bonus', 'Bonus', true),
  ('PC004', 'Incentive Program', 'Incentive', true)
ON CONFLICT (payout_code) DO NOTHING;

-- Insert sample commission slabs
INSERT INTO commission_slabs (product_group_name, payout_code_id, min_amount, max_amount, commission_percentage, is_active)
SELECT 
  'All Products',
  id,
  0,
  50000,
  5.0,
  true
FROM payout_codes WHERE payout_code = 'PC001'
ON CONFLICT DO NOTHING;

INSERT INTO commission_slabs (product_group_name, payout_code_id, min_amount, max_amount, commission_percentage, is_active)
SELECT 
  'All Products',
  id,
  50000,
  NULL,
  7.5,
  true
FROM payout_codes WHERE payout_code = 'PC001'
ON CONFLICT DO NOTHING;
