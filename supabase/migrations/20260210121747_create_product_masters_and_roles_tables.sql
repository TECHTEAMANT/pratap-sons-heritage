/*
  # Create Product Masters and User Roles System

  1. New Tables
    - `product_masters`
      - Stores design definitions without actual inventory
      - Contains product_group, color, design_no, vendor, mrp, gst_logic, photos, description
      - No size or quantity - just the master definition
    
    - `roles`
      - Defines user roles (Admin, Purchase Manager, Sales Person, etc.)
      - Includes permission flags for visibility and actions
    
  2. Changes to Existing Tables
    - `users` table gets `role_id` field
    - `product_items` table floor constraint changed to nullable
  
  3. Security
    - Enable RLS on both new tables
    - Add policies for authenticated users
    
  4. Permissions in Roles
    - can_view_cost: Can see cost prices
    - can_view_mrp: Can see MRP
    - can_manage_purchases: Can create/edit purchase orders
    - can_manage_sales: Can create/edit sales/billing
    - can_view_reports: Can access reports
    - can_manage_inventory: Can add/edit inventory items
    - can_manage_masters: Can edit master data
    - can_manage_users: Can create/edit users
*/

-- Create product_masters table
CREATE TABLE IF NOT EXISTS product_masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_no text NOT NULL,
  product_group uuid REFERENCES product_groups(id) NOT NULL,
  color uuid REFERENCES colors(id) NOT NULL,
  vendor uuid REFERENCES vendors(id) NOT NULL,
  mrp decimal(10,2) NOT NULL DEFAULT 0,
  gst_logic text NOT NULL DEFAULT 'AUTO_5_18',
  photos text[] DEFAULT '{}',
  description text DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(design_no, product_group, color, vendor)
);

-- Create index on design_no for quick lookups
CREATE INDEX IF NOT EXISTS idx_product_masters_design ON product_masters(design_no);
CREATE INDEX IF NOT EXISTS idx_product_masters_vendor ON product_masters(vendor);

-- Enable RLS on product_masters
ALTER TABLE product_masters ENABLE ROW LEVEL SECURITY;

-- Policies for product_masters
CREATE POLICY "Authenticated users can view product masters"
  ON product_masters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert product masters"
  ON product_masters FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product masters"
  ON product_masters FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  can_view_cost boolean DEFAULT false,
  can_view_mrp boolean DEFAULT true,
  can_manage_purchases boolean DEFAULT false,
  can_manage_sales boolean DEFAULT false,
  can_view_reports boolean DEFAULT false,
  can_manage_inventory boolean DEFAULT false,
  can_manage_masters boolean DEFAULT false,
  can_manage_users boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Policies for roles
CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add role_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE users ADD COLUMN role_id uuid REFERENCES roles(id);
  END IF;
END $$;

-- Create index on role_id for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- Make floor nullable in product_items
DO $$
BEGIN
  ALTER TABLE product_items ALTER COLUMN floor DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Insert default roles
INSERT INTO roles (name, description, can_view_cost, can_view_mrp, can_manage_purchases, can_manage_sales, can_view_reports, can_manage_inventory, can_manage_masters, can_manage_users)
VALUES 
  ('Admin', 'Full system access', true, true, true, true, true, true, true, true),
  ('Purchase Manager', 'Can manage purchases and view costs', true, true, true, false, true, true, false, false),
  ('Sales Person', 'Can manage sales and billing', false, true, false, true, true, false, false, false),
  ('Inventory Manager', 'Can manage inventory and master data', true, true, false, false, true, true, true, false),
  ('Viewer', 'Read-only access to reports', false, true, false, false, true, false, false, false)
ON CONFLICT (name) DO NOTHING;
