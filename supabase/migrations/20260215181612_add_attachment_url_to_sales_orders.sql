/*
  # Add Attachment URL to Sales Orders

  ## Changes
  - Add `attachment_url` column to `sales_orders` table to store image attachments

  ## Security
  - Column is nullable and accessible by authenticated users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_orders' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE sales_orders ADD COLUMN attachment_url text;
  END IF;
END $$;

