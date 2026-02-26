-- Add barcodes_per_item to purchase_items
ALTER TABLE purchase_items ADD COLUMN barcodes_per_item INTEGER DEFAULT 1;
