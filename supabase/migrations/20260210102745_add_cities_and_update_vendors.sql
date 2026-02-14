/*
  # Add Cities Master and Update Vendors

  1. New Tables
    - `cities`
      - `id` (uuid, primary key)
      - `name` (text) - City name
      - `state` (text) - State name
      - `city_code` (text, unique) - Two-letter code (RJ, RM, etc.)
      - `active` (boolean) - Active status
      - `created_at` (timestamp)
  
  2. Changes to Existing Tables
    - Add `city_id` to `vendors` table
    - Link vendors to cities for auto vendor code generation
  
  3. Security
    - Enable RLS on `cities` table
    - Add policies for authenticated users
  
  4. Data Population
    - Pre-populate with major Indian cities
*/

-- Create cities table
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text NOT NULL,
  city_code text UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add city reference to vendors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors' AND column_name = 'city_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN city_id uuid REFERENCES cities(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Policies for cities
CREATE POLICY "Authenticated users can read cities"
  ON cities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cities"
  ON cities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cities"
  ON cities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert major Indian cities
INSERT INTO cities (name, state, city_code, active) VALUES
  ('Jaipur', 'Rajasthan', 'RJ', true),
  ('Mumbai', 'Maharashtra', 'RM', true),
  ('Delhi', 'Delhi', 'RD', true),
  ('Bangalore', 'Karnataka', 'RB', true),
  ('Chennai', 'Tamil Nadu', 'RC', true),
  ('Kolkata', 'West Bengal', 'RK', true),
  ('Hyderabad', 'Telangana', 'RH', true),
  ('Ahmedabad', 'Gujarat', 'RA', true),
  ('Pune', 'Maharashtra', 'RP', true),
  ('Surat', 'Gujarat', 'RS', true),
  ('Lucknow', 'Uttar Pradesh', 'RL', true),
  ('Kanpur', 'Uttar Pradesh', 'RN', true),
  ('Nagpur', 'Maharashtra', 'RG', true),
  ('Indore', 'Madhya Pradesh', 'RI', true),
  ('Bhopal', 'Madhya Pradesh', 'RO', true),
  ('Vadodara', 'Gujarat', 'RV', true),
  ('Chandigarh', 'Chandigarh', 'RU', true),
  ('Coimbatore', 'Tamil Nadu', 'RE', true),
  ('Kochi', 'Kerala', 'RX', true),
  ('Visakhapatnam', 'Andhra Pradesh', 'RW', true)
ON CONFLICT (city_code) DO NOTHING;
