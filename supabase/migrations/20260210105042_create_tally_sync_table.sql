/*
  # Create Tally Sync Table

  1. New Tables
    - `tally_sync`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key to sales_invoices)
      - `invoice_number` (text) - Invoice number for reference
      - `invoice_date` (date) - Invoice date
      - `customer_name` (text) - Customer name
      - `total_amount` (numeric) - Total invoice amount
      - `sync_data` (jsonb) - Complete JSON data grouped by product groups
      - `sync_status` (text) - Status: 'pending', 'synced', 'failed'
      - `synced_at` (timestamptz) - When it was synced
      - `error_message` (text) - Error message if sync failed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `tally_sync` table
    - Add policies for authenticated users to manage Tally sync
  
  3. Indexes
    - Index on invoice_id for faster lookups
    - Index on sync_status for filtering
    - Index on invoice_number for search
*/

-- Create tally_sync table
CREATE TABLE IF NOT EXISTS tally_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  customer_name text,
  customer_mobile text,
  total_amount numeric NOT NULL DEFAULT 0,
  sync_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'pending',
  synced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tally_sync_invoice_id ON tally_sync(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tally_sync_status ON tally_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_tally_sync_invoice_number ON tally_sync(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tally_sync_date ON tally_sync(invoice_date);

-- Enable RLS
ALTER TABLE tally_sync ENABLE ROW LEVEL SECURITY;

-- Policies for tally_sync
CREATE POLICY "Authenticated users can read tally sync"
  ON tally_sync FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tally sync"
  ON tally_sync FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tally sync"
  ON tally_sync FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tally sync"
  ON tally_sync FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tally_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tally_sync_updated_at'
  ) THEN
    CREATE TRIGGER tally_sync_updated_at
      BEFORE UPDATE ON tally_sync
      FOR EACH ROW
      EXECUTE FUNCTION update_tally_sync_updated_at();
  END IF;
END $$;
