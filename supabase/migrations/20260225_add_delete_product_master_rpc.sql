-- RPC to delete a product_master entry (No Stock Received items)
-- This bypasses RLS since product_masters has no DELETE policy
-- Safe to delete only if: no barcode_batches exist for this design+vendor+group+color

CREATE OR REPLACE FUNCTION delete_product_master(
  p_design_no    TEXT,
  p_vendor_id    UUID,
  p_group_id     UUID,
  p_color_id     UUID  -- can be NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_count INTEGER;
  v_master_id   UUID;
BEGIN
  -- Find the product_master row
  IF p_color_id IS NOT NULL THEN
    SELECT id INTO v_master_id
    FROM product_masters
    WHERE design_no     = p_design_no
      AND vendor        = p_vendor_id
      AND product_group = p_group_id
      AND color         = p_color_id;
  ELSE
    SELECT id INTO v_master_id
    FROM product_masters
    WHERE design_no     = p_design_no
      AND vendor        = p_vendor_id
      AND product_group = p_group_id
      AND color IS NULL;
  END IF;

  IF v_master_id IS NULL THEN
    RAISE EXCEPTION 'Item not found in product masters.';
  END IF;

  -- Safety check: ensure no barcode_batches exist for this item
  SELECT COUNT(*) INTO v_batch_count
  FROM barcode_batches
  WHERE design_no     = p_design_no
    AND vendor        = p_vendor_id
    AND product_group = p_group_id;

  IF v_batch_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: This item has % stock batch(es). Use the size delete button instead.', v_batch_count;
  END IF;

  -- Safe to delete
  DELETE FROM product_masters WHERE id = v_master_id;

  RETURN jsonb_build_object(
    'success', true,
    'design_no', p_design_no,
    'message', 'Item removed from inventory successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_product_master(TEXT, UUID, UUID, UUID) TO authenticated;
