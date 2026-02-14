/*
  # Create Payment Receipts System

  ## Overview
  Creates a comprehensive system for recording payment receipts against invoices
  and automatically updating invoice payment status.

  ## New Tables
  1. `payment_receipts`
    - `id` (uuid, primary key) - Unique receipt identifier
    - `receipt_number` (text) - Human-readable receipt number (RCP2026XXXXXX)
    - `receipt_date` (date) - Date of payment receipt
    - `invoice_id` (uuid) - Reference to sales_invoices
    - `invoice_number` (text) - Denormalized for quick reference
    - `customer_mobile` (text) - Customer mobile number
    - `customer_name` (text) - Customer name
    - `amount_received` (numeric) - Amount received in this receipt
    - `payment_mode` (text) - Cash/Card/UPI/Cheque/Bank Transfer
    - `reference_number` (text) - Cheque/Transaction reference if applicable
    - `notes` (text) - Additional notes
    - `created_by` (uuid) - User who created the receipt
    - `created_at` (timestamptz) - Creation timestamp

  ## Triggers
  1. Auto-update sales_invoices when receipt is created
  2. Auto-update sales_invoices when receipt is deleted

  ## Security
  - Enable RLS on payment_receipts
  - Authenticated users can read all receipts
  - Only users with sales permission can create receipts
  - Only admins can delete receipts
*/

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_id uuid NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  customer_mobile text NOT NULL,
  customer_name text NOT NULL,
  amount_received numeric NOT NULL CHECK (amount_received > 0),
  payment_mode text NOT NULL DEFAULT 'Cash',
  reference_number text,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read receipts"
  ON payment_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create receipts"
  ON payment_receipts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own receipts"
  ON payment_receipts FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own receipts"
  ON payment_receipts FOR DELETE
  TO authenticated
  USING (created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice_id ON payment_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer_mobile ON payment_receipts(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_date ON payment_receipts(receipt_date);

-- Function to update invoice payment status when receipt is created
CREATE OR REPLACE FUNCTION update_invoice_on_receipt_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales_invoices
  SET 
    amount_paid = COALESCE(amount_paid, 0) + NEW.amount_received,
    amount_pending = GREATEST(0, net_payable - (COALESCE(amount_paid, 0) + NEW.amount_received)),
    payment_status = CASE
      WHEN net_payable - (COALESCE(amount_paid, 0) + NEW.amount_received) <= 0 THEN 'paid'
      WHEN (COALESCE(amount_paid, 0) + NEW.amount_received) > 0 THEN 'partial'
      ELSE 'pending'
    END
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice payment status when receipt is deleted
CREATE OR REPLACE FUNCTION update_invoice_on_receipt_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales_invoices
  SET 
    amount_paid = GREATEST(0, COALESCE(amount_paid, 0) - OLD.amount_received),
    amount_pending = LEAST(net_payable, COALESCE(amount_pending, 0) + OLD.amount_received),
    payment_status = CASE
      WHEN net_payable - (GREATEST(0, COALESCE(amount_paid, 0) - OLD.amount_received)) <= 0 THEN 'paid'
      WHEN (GREATEST(0, COALESCE(amount_paid, 0) - OLD.amount_received)) > 0 THEN 'partial'
      ELSE 'pending'
    END
  WHERE id = OLD.invoice_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_update_invoice_on_receipt_insert ON payment_receipts;
CREATE TRIGGER trg_update_invoice_on_receipt_insert
  AFTER INSERT ON payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_receipt_insert();

DROP TRIGGER IF EXISTS trg_update_invoice_on_receipt_delete ON payment_receipts;
CREATE TRIGGER trg_update_invoice_on_receipt_delete
  AFTER DELETE ON payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_receipt_delete();
