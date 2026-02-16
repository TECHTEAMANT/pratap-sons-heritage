/*
  # Create Purchase Order Items Table

  ## Overview
  This migration creates a table to store individual items within purchase orders,
  enabling detailed tracking of each product ordered.

  ## New Tables

  ### purchase_order_items
  - `id` (uuid, primary key) - Unique identifier
  - `purchase_order_id` (uuid) - Reference to purchase_orders table
  - `design_no` (text) - Design/model number (optional)
  - `product_description` (text) - Description of the product
  - `quantity` (integer) - Quantity ordered
  - `rate` (decimal) - Price per unit
  - `total` (decimal) - Line item total (quantity × rate)
  - `created_at` (timestamptz) - Timestamp of creation

  ## Security
  - Enable RLS on the table
  - Create policies for authenticated users to manage items
*/

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  design_no text DEFAULT '',
  product_description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate decimal(10,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  total decimal(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(purchase_order_id);

-- Enable Row Level Security
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Authenticated users can view PO items"
  ON purchase_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create PO items"
  ON purchase_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update PO items"
  ON purchase_order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete PO items"
  ON purchase_order_items FOR DELETE
  TO authenticated
  USING (true);

