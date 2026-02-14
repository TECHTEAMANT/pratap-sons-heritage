/*
  # Create Defective Stock Tracking System

  1. New Tables
    - `defective_stock`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to product_items table) - The actual inventory item marked as defective
      - `barcode` (text) - Barcode of the defective item
      - `quantity` (integer) - Quantity marked as defective
      - `reason` (text) - Reason for marking as defective
      - `notes` (text, optional) - Additional notes
      - `marked_by` (uuid, foreign key to users table) - User who marked it defective
      - `marked_at` (timestamptz) - When it was marked defective
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `defective_stock` table
    - Add policies for authenticated users to:
      - View all defective stock records
      - Create new defective stock records
      - Update defective stock records
      - Delete defective stock records (for admins)
  
  3. Purpose
    - Track items marked as defective
    - Maintain defective stock history
    - Generate defective stock reports
    - Help with inventory accuracy
*/

CREATE TABLE IF NOT EXISTS defective_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES product_items(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  notes text,
  marked_by uuid REFERENCES users(id),
  marked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE defective_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view defective stock"
  ON defective_stock
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create defective stock records"
  ON defective_stock
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update defective stock records"
  ON defective_stock
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete defective stock records"
  ON defective_stock
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_defective_stock_barcode ON defective_stock(barcode);
CREATE INDEX IF NOT EXISTS idx_defective_stock_item_id ON defective_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_defective_stock_marked_at ON defective_stock(marked_at DESC);
