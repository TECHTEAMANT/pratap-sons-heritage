/*
  # Create Purchase Returns System

  1. New Tables
    - `purchase_returns`
      - `id` (uuid, primary key)
      - `return_number` (text, unique) - Unique return number
      - `vendor_id` (uuid) - Reference to vendor
      - `original_po_id` (uuid) - Reference to original purchase order
      - `return_date` (date) - Date of return
      - `total_items` (integer) - Total number of items returned
      - `total_amount` (numeric) - Total return amount
      - `reason` (text) - Reason for return
      - `notes` (text) - Additional notes
      - `status` (text) - Status: 'draft', 'confirmed', 'completed'
      - `created_by` (uuid) - User who created the return
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `purchase_return_items`
      - `id` (uuid, primary key)
      - `return_id` (uuid) - Reference to purchase_returns
      - `item_id` (uuid) - Reference to product_items
      - `barcode_id` (text) - Barcode of returned item
      - `reason` (text) - Item-specific return reason
      - `condition` (text) - Item condition: 'defective', 'damaged', 'wrong_item', 'excess'
      - `cost` (numeric) - Cost of returned item
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
  
  3. Indexes
    - Index on vendor_id, return_number, status, return_date
*/

-- Create purchase_returns table
CREATE TABLE IF NOT EXISTS purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text UNIQUE NOT NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  original_po_id uuid REFERENCES purchase_orders(id),
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  total_items integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  reason text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchase_return_items table
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES product_items(id),
  barcode_id text NOT NULL,
  reason text,
  condition text NOT NULL DEFAULT 'defective',
  cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for purchase_returns
CREATE INDEX IF NOT EXISTS idx_purchase_returns_vendor ON purchase_returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_number ON purchase_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_po ON purchase_returns(original_po_id);

-- Create indexes for purchase_return_items
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_item ON purchase_return_items(item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_barcode ON purchase_return_items(barcode_id);

-- Enable RLS
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;

-- Policies for purchase_returns
CREATE POLICY "Authenticated users can read purchase returns"
  ON purchase_returns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert purchase returns"
  ON purchase_returns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchase returns"
  ON purchase_returns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchase returns"
  ON purchase_returns FOR DELETE
  TO authenticated
  USING (true);

-- Policies for purchase_return_items
CREATE POLICY "Authenticated users can read purchase return items"
  ON purchase_return_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert purchase return items"
  ON purchase_return_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchase return items"
  ON purchase_return_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchase return items"
  ON purchase_return_items FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-update updated_at timestamp for purchase_returns
CREATE OR REPLACE FUNCTION update_purchase_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for purchase_returns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'purchase_returns_updated_at'
  ) THEN
    CREATE TRIGGER purchase_returns_updated_at
      BEFORE UPDATE ON purchase_returns
      FOR EACH ROW
      EXECUTE FUNCTION update_purchase_returns_updated_at();
  END IF;
END $$;

-- Function to update item status to 'Returned' when added to purchase return
CREATE OR REPLACE FUNCTION mark_item_as_returned()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_items
  SET status = 'Returned',
      updated_at = now()
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to mark item as returned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'mark_item_returned_trigger'
  ) THEN
    CREATE TRIGGER mark_item_returned_trigger
      AFTER INSERT ON purchase_return_items
      FOR EACH ROW
      EXECUTE FUNCTION mark_item_as_returned();
  END IF;
END $$;
