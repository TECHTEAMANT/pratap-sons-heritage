/*
  # Major System Overhaul - New Barcode Batch System

  ## Overview
  This migration introduces a completely new barcode system that moves from individual item barcodes 
  to batch-based barcodes with 8-digit numeric aliases and quantity tracking.

  ## New Tables
  
  ### 1. barcode_batches
  - Replaces individual product_items with batch-based inventory
  - Each batch represents multiple units of the same item
  - Uses 8-digit numeric alias as primary scan code
  - Tracks quantity instead of individual items
  
  Fields:
  - `barcode_alias_8digit` (text, unique) - 8-digit numeric code (PRIMARY SCAN)
  - `barcode_structured` (text) - Human-readable format: PG-CL-SZ-DESIGN-VENDOR-COST-ORDER-PY
  - `design_no` (text) - Design number
  - `product_group` (uuid) - FK to product_groups
  - `size` (uuid) - FK to sizes
  - `color` (uuid) - FK to colors
  - `vendor` (uuid) - FK to vendors
  - `payout_code` (text, nullable) - For commission tracking
  - `cost_actual` (decimal) - Actual cost
  - `cost_encoded` (text) - Encoded cost string
  - `mrp` (decimal) - Maximum retail price
  - `gst_logic` (text) - GST calculation logic
  - `total_quantity` (integer) - Total units in this batch
  - `available_quantity` (integer) - Available units
  - `floor` (uuid, nullable) - FK to floors
  - `discount_type` (text, nullable) - 'percentage' or 'flat'
  - `discount_value` (decimal, nullable) - Discount amount
  - `discount_start_date` (date, nullable)
  - `discount_end_date` (date, nullable)
  - `status` (text) - 'active', 'inactive'
  - `po_id` (uuid, nullable) - FK to purchase_orders
  - `created_by` (uuid, nullable) - FK to users
  - `modified_by` (uuid, nullable) - FK to users
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. discount_masters
  - Master table for discount configurations
  
  Fields:
  - `id` (uuid)
  - `flag_name` (text) - Discount flag name
  - `discount_type` (text) - 'percentage' or 'flat'
  - `default_value` (decimal) - Default discount value
  - `active` (boolean) - Active flag
  - `created_by` (uuid, nullable)
  - `created_at` (timestamptz)

  ### 3. barcode_print_logs
  - Audit log for all barcode printing activities
  
  Fields:
  - `id` (uuid)
  - `barcode_alias` (text) - The 8-digit barcode printed
  - `quantity_printed` (integer) - Number of labels printed
  - `reason` (text) - Reason for printing
  - `printed_by` (uuid) - FK to users
  - `printed_at` (timestamptz)

  ### 4. barcode_sequence
  - Manages 8-digit sequential numbering
  
  Fields:
  - `id` (integer)
  - `last_number` (integer) - Last used number
  - `updated_at` (timestamptz)

  ## Modified Tables
  
  ### purchase_orders
  - Add `taxable_value` (decimal) - User-entered taxable value
  - Add `manual_gst_amount` (decimal, nullable) - Manually adjusted GST
  - Add `vendor_invoice_attachment` (text, nullable) - File URL
  - Add `gst_difference_reason` (text, nullable) - Why GST was manually adjusted
  - Add `created_by` (uuid, nullable)
  - Add `modified_by` (uuid, nullable)

  ### sales_invoices
  - Add `created_by` (uuid, nullable)
  - Add `modified_by` (uuid, nullable)

  ### purchase_returns
  - Add `created_by` (uuid, nullable)
  - Add `modified_by` (uuid, nullable)

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users based on permissions

  ## Notes
  - This is a breaking change from the old system
  - Old product_items table is kept for data migration purposes
  - New system uses batch quantities instead of individual items
  - 8-digit barcode alias is the PRIMARY identifier for scanning
*/

-- Create barcode sequence table
CREATE TABLE IF NOT EXISTS barcode_sequence (
  id integer PRIMARY KEY DEFAULT 1,
  last_number integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO barcode_sequence (id, last_number) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Create discount masters table
CREATE TABLE IF NOT EXISTS discount_masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  default_value decimal(10,2) NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Create barcode batches table (NEW SYSTEM)
CREATE TABLE IF NOT EXISTS barcode_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_alias_8digit text UNIQUE NOT NULL,
  barcode_structured text NOT NULL,
  design_no text NOT NULL,
  product_group uuid REFERENCES product_groups(id) NOT NULL,
  size uuid REFERENCES sizes(id) NOT NULL,
  color uuid REFERENCES colors(id) NOT NULL,
  vendor uuid REFERENCES vendors(id) NOT NULL,
  payout_code text,
  cost_actual decimal(10,2) NOT NULL,
  cost_encoded text,
  mrp decimal(10,2) NOT NULL,
  gst_logic text NOT NULL DEFAULT 'AUTO_5_18',
  total_quantity integer NOT NULL DEFAULT 0,
  available_quantity integer NOT NULL DEFAULT 0,
  floor uuid REFERENCES floors(id),
  discount_type text CHECK (discount_type IN ('percentage', 'flat')),
  discount_value decimal(10,2),
  discount_start_date date,
  discount_end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  po_id uuid REFERENCES purchase_orders(id),
  photos text[],
  description text,
  created_by uuid REFERENCES users(id),
  modified_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast barcode lookup
CREATE INDEX IF NOT EXISTS idx_barcode_batches_alias ON barcode_batches(barcode_alias_8digit);
CREATE INDEX IF NOT EXISTS idx_barcode_batches_structured ON barcode_batches(barcode_structured);
CREATE INDEX IF NOT EXISTS idx_barcode_batches_status ON barcode_batches(status);
CREATE INDEX IF NOT EXISTS idx_barcode_batches_vendor ON barcode_batches(vendor);

-- Create barcode print logs table
CREATE TABLE IF NOT EXISTS barcode_print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_alias text NOT NULL,
  barcode_batch_id uuid REFERENCES barcode_batches(id),
  quantity_printed integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  printed_by uuid REFERENCES users(id) NOT NULL,
  printed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barcode_print_logs_printed_at ON barcode_print_logs(printed_at DESC);
CREATE INDEX IF NOT EXISTS idx_barcode_print_logs_printed_by ON barcode_print_logs(printed_by);

-- Add audit fields to existing tables
DO $$
BEGIN
  -- purchase_orders audit and manual GST fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'taxable_value') THEN
    ALTER TABLE purchase_orders ADD COLUMN taxable_value decimal(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'manual_gst_amount') THEN
    ALTER TABLE purchase_orders ADD COLUMN manual_gst_amount decimal(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_invoice_attachment') THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_invoice_attachment text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'gst_difference_reason') THEN
    ALTER TABLE purchase_orders ADD COLUMN gst_difference_reason text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'modified_by') THEN
    ALTER TABLE purchase_orders ADD COLUMN modified_by uuid REFERENCES users(id);
  END IF;

  -- sales_invoices audit fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_invoices' AND column_name = 'modified_by') THEN
    ALTER TABLE sales_invoices ADD COLUMN modified_by uuid REFERENCES users(id);
  END IF;

  -- purchase_returns audit fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_returns' AND column_name = 'modified_by') THEN
    ALTER TABLE purchase_returns ADD COLUMN modified_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Function to get next barcode number
CREATE OR REPLACE FUNCTION get_next_barcode_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  barcode_str text;
BEGIN
  UPDATE barcode_sequence 
  SET last_number = last_number + 1,
      updated_at = now()
  WHERE id = 1
  RETURNING last_number INTO next_num;
  
  -- Format as 8-digit string with leading zeros
  barcode_str := LPAD(next_num::text, 8, '0');
  
  RETURN barcode_str;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE barcode_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_print_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_sequence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for barcode_batches
CREATE POLICY "Users can view all barcode batches"
  ON barcode_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with inventory permission can insert barcode batches"
  ON barcode_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.can_manage_inventory = true
    )
  );

CREATE POLICY "Users with inventory permission can update barcode batches"
  ON barcode_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.can_manage_inventory = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.can_manage_inventory = true
    )
  );

-- RLS Policies for discount_masters
CREATE POLICY "Users can view all discount masters"
  ON discount_masters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with master data permission can manage discount masters"
  ON discount_masters FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.can_manage_masters = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.can_manage_masters = true
    )
  );

-- RLS Policies for barcode_print_logs
CREATE POLICY "Users can view barcode print logs"
  ON barcode_print_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert barcode print logs"
  ON barcode_print_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for barcode_sequence
CREATE POLICY "Users can view barcode sequence"
  ON barcode_sequence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update barcode sequence"
  ON barcode_sequence FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert some default discount masters
INSERT INTO discount_masters (flag_name, discount_type, default_value, active) VALUES
  ('Seasonal Sale', 'percentage', 10.00, true),
  ('Clearance', 'percentage', 20.00, true),
  ('Festival Offer', 'flat', 100.00, true),
  ('Bulk Discount', 'percentage', 5.00, true)
ON CONFLICT (flag_name) DO NOTHING;
