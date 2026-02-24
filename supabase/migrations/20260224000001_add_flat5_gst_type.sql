-- Add 'FLAT_5' value to both possible GST enum types in the database
-- This ensures that columns using either name are compatible with the new 5% GST type

DO $$ 
BEGIN
  -- Add to gst_transaction_type (usually used for CGST_SGST/IGST)
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gst_transaction_type') THEN
    ALTER TYPE gst_transaction_type ADD VALUE IF NOT EXISTS 'FLAT_5';
  END IF;

  -- Add to gst_type (often used for gst_logic columns like in purchase_items)
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gst_type') THEN
    ALTER TYPE gst_type ADD VALUE IF NOT EXISTS 'FLAT_5';
  END IF;
END $$;
