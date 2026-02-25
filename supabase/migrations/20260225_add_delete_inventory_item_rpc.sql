-- RPC to safely delete a single inventory batch (barcode_batches row)
-- Pre-checks:
--   1. Block if sales records exist (sales_invoice_items)
--   2. Block if active bookings exist (e_bookings)
-- Auto-clean:
--   - Delete barcode_print_logs rows
-- Hard delete the barcode_batches row

CREATE OR REPLACE FUNCTION delete_inventory_item(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_barcode     TEXT;
  v_design_no   TEXT;
  v_sales_count INTEGER;
  v_booking_count INTEGER;
BEGIN
  -- Get the barcode alias for this batch
  SELECT barcode_alias_8digit, design_no
  INTO v_barcode, v_design_no
  FROM barcode_batches
  WHERE id = p_batch_id;

  IF v_barcode IS NULL THEN
    RAISE EXCEPTION 'Inventory item not found.';
  END IF;

  -- CHECK 1: Block if this barcode has any sales records (outer records)
  SELECT COUNT(*) INTO v_sales_count
  FROM sales_invoice_items
  WHERE barcode_8digit = v_barcode;

  IF v_sales_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: This inventory item has % sales record(s). Items that have been sold cannot be deleted.', v_sales_count;
  END IF;

  -- CHECK 2: Block if there is an active booking for this barcode
  SELECT COUNT(*) INTO v_booking_count
  FROM e_bookings
  WHERE barcode_8digit = v_barcode
    AND status NOT IN ('invoiced', 'cancelled');

  IF v_booking_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: This inventory item has % active booking(s). Cancel the booking(s) first before deleting.', v_booking_count;
  END IF;

  -- AUTO-CLEAN: Delete barcode_print_logs (safe audit history cleanup)
  DELETE FROM barcode_print_logs
  WHERE barcode_alias = v_barcode
     OR barcode_batch_id = p_batch_id;

  -- HARD DELETE the barcode_batches row
  DELETE FROM barcode_batches
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'design_no', v_design_no,
    'barcode', v_barcode,
    'message', 'Inventory item deleted successfully.'
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_inventory_item(UUID) TO authenticated;
