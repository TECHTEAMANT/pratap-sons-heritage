-- Create RPC to delete a purchase invoice with full cascading cleanup
-- This RPC handles:
-- 1. Reverting barcode_batches quantities (total_quantity and available_quantity)
-- 2. Deleting purchase_items
-- 3. Deleting the purchase_orders record

CREATE OR REPLACE FUNCTION delete_purchase_invoice(p_po_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_po_number TEXT;
  v_deleted_items INTEGER := 0;
BEGIN
  -- Verify the purchase order exists
  SELECT po_number INTO v_po_number
  FROM purchase_orders
  WHERE id = p_po_id;

  IF v_po_number IS NULL THEN
    RAISE EXCEPTION 'Purchase invoice not found: %', p_po_id;
  END IF;

  -- Process each purchase item: revert barcode_batches quantities
  FOR v_item IN
    SELECT
      pi.id AS item_id,
      pi.design_no,
      pi.product_group,
      pi.color,
      pi.size,
      pi.quantity,
      po.vendor
    FROM purchase_items pi
    JOIN purchase_orders po ON po.id = pi.po_id
    WHERE pi.po_id = p_po_id
  LOOP
    -- Find the matching barcode batch and reduce quantities
    -- Use IS NOT DISTINCT FROM to handle NULL colors properly
    UPDATE barcode_batches
    SET
      total_quantity     = GREATEST(0, total_quantity - v_item.quantity),
      available_quantity = GREATEST(0, available_quantity - v_item.quantity),
      updated_at         = NOW()
    WHERE design_no      = v_item.design_no
      AND product_group  = v_item.product_group
      AND size           = v_item.size
      AND vendor         = v_item.vendor
      AND color IS NOT DISTINCT FROM v_item.color;

    v_deleted_items := v_deleted_items + 1;
  END LOOP;

  -- Delete barcode_batches rows that now have 0 total_quantity
  -- Only delete if available_quantity also equals total_quantity (nothing sold)
  DELETE FROM barcode_batches
  WHERE po_id = p_po_id
    AND total_quantity <= 0
    AND available_quantity <= 0;

  -- Delete all purchase items for this PO
  DELETE FROM purchase_items
  WHERE po_id = p_po_id;

  -- Delete the purchase order itself
  DELETE FROM purchase_orders
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'success', true,
    'po_number', v_po_number,
    'items_processed', v_deleted_items
  );
END;
$$;

-- Grant execute to authenticated users
-- (role-based access is enforced on the frontend)
GRANT EXECUTE ON FUNCTION delete_purchase_invoice(UUID) TO authenticated;
