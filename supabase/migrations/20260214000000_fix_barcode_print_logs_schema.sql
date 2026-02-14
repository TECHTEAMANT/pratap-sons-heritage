/*
  # Fix Barcode Print Logs Schema
  
  This migration fixes the missing columns in `barcode_print_logs` table.
  The table was originally created by `20260210073608_add_invoice_number_and_audit_logs.sql` with a different schema.
  The migration `20260211152556_create_new_barcode_batch_system.sql` attempted to create it with new columns but used `IF NOT EXISTS`, so the new columns were never added.

  This migration adds the missing columns to support the new Barcode Management system while maintaining compatibility with the existing PO print logs.

  Added columns:
  - `barcode_alias` (text, nullable)
  - `barcode_batch_id` (uuid, nullable)
  - `quantity_printed` (integer, nullable)
  - `reason` (text, nullable)
*/

DO $$
BEGIN
  -- Add barcode_alias
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barcode_print_logs' AND column_name = 'barcode_alias') THEN
    ALTER TABLE barcode_print_logs ADD COLUMN barcode_alias text;
  END IF;

  -- Add barcode_batch_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barcode_print_logs' AND column_name = 'barcode_batch_id') THEN
    ALTER TABLE barcode_print_logs ADD COLUMN barcode_batch_id uuid REFERENCES barcode_batches(id);
  END IF;

  -- Add quantity_printed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barcode_print_logs' AND column_name = 'quantity_printed') THEN
    ALTER TABLE barcode_print_logs ADD COLUMN quantity_printed integer;
  END IF;

  -- Add reason
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barcode_print_logs' AND column_name = 'reason') THEN
    ALTER TABLE barcode_print_logs ADD COLUMN reason text;
  END IF;
END $$;
