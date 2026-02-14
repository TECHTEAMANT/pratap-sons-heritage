/*
  # Add Invoice Number and Barcode Print Audit Logs

  1. Changes to Purchase Orders
    - Add `invoice_number` column to store vendor invoice number
    - Add `gst_breakdown` column to store GST details for Tally export (JSONB)
    
  2. New Tables
    - `barcode_print_logs`
      - `id` (uuid, primary key)
      - `po_id` (uuid, references purchase_orders)
      - `invoice_number` (text) - from PO
      - `order_number` (text) - from PO
      - `items_printed` (jsonb) - array of items with barcode details
      - `printed_by` (uuid, references users)
      - `printed_at` (timestamp)
      
  3. Security
    - Enable RLS on `barcode_print_logs` table
    - Add policies for authenticated users
    
  4. Notes
    - GST breakdown stored as JSON with product_group_id as key
    - Audit logs track all barcode printing activities
*/

-- Add fields to purchase_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN invoice_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'gst_breakdown'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN gst_breakdown jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create barcode_print_logs table
CREATE TABLE IF NOT EXISTS barcode_print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  invoice_number text,
  order_number text,
  items_printed jsonb DEFAULT '[]'::jsonb,
  printed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  printed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE barcode_print_logs ENABLE ROW LEVEL SECURITY;

-- Policies for barcode_print_logs
CREATE POLICY "Authenticated users can view barcode print logs"
  ON barcode_print_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert barcode print logs"
  ON barcode_print_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_barcode_print_logs_po_id ON barcode_print_logs(po_id);
CREATE INDEX IF NOT EXISTS idx_barcode_print_logs_printed_at ON barcode_print_logs(printed_at DESC);
