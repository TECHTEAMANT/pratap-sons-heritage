-- Add 'flat_5' value to the gst_transaction_type enum
-- This allows purchase invoices (and other tables) to store a flat 5% GST type
ALTER TYPE gst_transaction_type ADD VALUE IF NOT EXISTS 'flat_5';
