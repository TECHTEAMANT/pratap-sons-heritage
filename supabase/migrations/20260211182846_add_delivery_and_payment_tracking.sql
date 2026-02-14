/*
  # Add Delivery and Payment Tracking

  ## Changes to sales_invoice_items
  - Add `delivered` (boolean) - tracks if item was delivered, default false
  - Add `delivery_date` (date) - tracks when item was delivered
  - Add `barcode_8digit` (text) - stores barcode for reference
  - Add `design_no` (text) - stores design number for reference
  - Add `selling_price` (numeric) - stores actual selling price after discount

  ## Changes to sales_invoices
  - Add `amount_paid` (numeric) - amount paid by customer, default 0
  - Add `amount_pending` (numeric) - remaining amount to be paid, default to net_payable
  - Add `payment_status` (text) - 'paid', 'partial', 'pending', default 'pending'

  ## Security
  - No RLS changes needed (existing policies apply)
*/

-- Add delivery tracking to sales_invoice_items
ALTER TABLE sales_invoice_items 
ADD COLUMN IF NOT EXISTS delivered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_date date,
ADD COLUMN IF NOT EXISTS barcode_8digit text,
ADD COLUMN IF NOT EXISTS design_no text,
ADD COLUMN IF NOT EXISTS selling_price numeric DEFAULT 0;

-- Add payment tracking to sales_invoices
ALTER TABLE sales_invoices 
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_pending numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Update existing records to set amount_pending = net_payable where it's still 0
UPDATE sales_invoices 
SET amount_pending = net_payable 
WHERE amount_pending = 0 AND net_payable > 0;

-- Create index for faster queries on delivery status
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_delivered 
ON sales_invoice_items(delivered);

-- Create index for payment status queries
CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment_status 
ON sales_invoices(payment_status);
