/*
  # Add GST Breakdown and Salesman Tracking

  1. Changes to Existing Tables
    - Add GST breakdown fields (CGST/SGST or IGST) to sales_invoices
    - Add GST breakdown fields to sales_invoice_items
    - Add GST breakdown fields to sales_returns
    - Add salesman_id to sales_invoice_items for item-level tracking
    - Add place_of_supply tracking for determining intra/inter-state
  
  2. New Columns
    - `gst_type` - enum: 'CGST_SGST' or 'IGST'
    - `cgst_amount`, `sgst_amount`, `igst_amount` columns
    - Update existing GST columns to support both types
  
  3. Notes
    - CGST + SGST = IGST (for same total GST amount)
    - Intra-state transactions use CGST+SGST
    - Inter-state transactions use IGST
*/

-- Add GST type enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gst_transaction_type') THEN
    CREATE TYPE gst_transaction_type AS ENUM ('CGST_SGST', 'IGST');
  END IF;
END $$;

-- Update sales_invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoices' AND column_name = 'gst_type'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN gst_type gst_transaction_type DEFAULT 'CGST_SGST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoices' AND column_name = 'igst_5'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN igst_5 numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoices' AND column_name = 'igst_18'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN igst_18 numeric DEFAULT 0;
  END IF;
END $$;

-- Update sales_invoice_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoice_items' AND column_name = 'gst_type'
  ) THEN
    ALTER TABLE sales_invoice_items ADD COLUMN gst_type gst_transaction_type DEFAULT 'CGST_SGST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoice_items' AND column_name = 'igst_percentage'
  ) THEN
    ALTER TABLE sales_invoice_items ADD COLUMN igst_percentage numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoice_items' AND column_name = 'igst_amount'
  ) THEN
    ALTER TABLE sales_invoice_items ADD COLUMN igst_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoice_items' AND column_name = 'salesman_id'
  ) THEN
    ALTER TABLE sales_invoice_items ADD COLUMN salesman_id uuid REFERENCES salesmen(id);
  END IF;
END $$;

-- Update sales_returns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_returns' AND column_name = 'gst_type'
  ) THEN
    ALTER TABLE sales_returns ADD COLUMN gst_type gst_transaction_type DEFAULT 'CGST_SGST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_returns' AND column_name = 'cgst_amount'
  ) THEN
    ALTER TABLE sales_returns ADD COLUMN cgst_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_returns' AND column_name = 'sgst_amount'
  ) THEN
    ALTER TABLE sales_returns ADD COLUMN sgst_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_returns' AND column_name = 'igst_amount'
  ) THEN
    ALTER TABLE sales_returns ADD COLUMN igst_amount numeric DEFAULT 0;
  END IF;
END $$;

-- Update purchase_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'gst_type'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN gst_type gst_transaction_type DEFAULT 'CGST_SGST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'vendor_state'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN vendor_state text;
  END IF;
END $$;

-- Update purchase_returns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_returns' AND column_name = 'gst_type'
  ) THEN
    ALTER TABLE purchase_returns ADD COLUMN gst_type gst_transaction_type DEFAULT 'CGST_SGST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_returns' AND column_name = 'cgst_amount'
  ) THEN
    ALTER TABLE purchase_returns ADD COLUMN cgst_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_returns' AND column_name = 'sgst_amount'
  ) THEN
    ALTER TABLE purchase_returns ADD COLUMN sgst_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_returns' AND column_name = 'igst_amount'
  ) THEN
    ALTER TABLE purchase_returns ADD COLUMN igst_amount numeric DEFAULT 0;
  END IF;
END $$;