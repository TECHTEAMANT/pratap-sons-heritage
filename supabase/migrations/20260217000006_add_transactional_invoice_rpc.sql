CREATE OR REPLACE FUNCTION generate_invoice_transaction(
  p_invoice_data JSONB,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_count INTEGER;
  v_item JSONB;
  v_current_qty INTEGER;
BEGIN
  -- 1. Generate Invoice Number safely (Locking the table to prevent duplicates)
  LOCK TABLE sales_invoices IN EXCLUSIVE MODE;
  SELECT COUNT(*) INTO v_count FROM sales_invoices;
  v_invoice_number := 'INV' || to_char(now(), 'YYYY') || lpad((v_count + 1)::text, 6, '0');

  -- 2. Insert Invoice Header
  INSERT INTO sales_invoices (
    invoice_number, invoice_date, customer_mobile, customer_name,
    total_mrp, total_discount, taxable_value, total_gst, gst_type,
    net_payable, payment_mode, amount_paid, amount_pending, payment_status,
    created_by, cgst_5, sgst_5, cgst_18, sgst_18, igst_5, igst_18,
    customer_id
  ) VALUES (
    v_invoice_number,
    (p_invoice_data->>'invoice_date')::DATE,
    p_invoice_data->>'customer_mobile',
    p_invoice_data->>'customer_name',
    (p_invoice_data->>'total_mrp')::NUMERIC,
    (p_invoice_data->>'total_discount')::NUMERIC,
    (p_invoice_data->>'taxable_value')::NUMERIC,
    (p_invoice_data->>'total_gst')::NUMERIC,
    (p_invoice_data->>'gst_type')::gst_transaction_type, -- Explicitly cast to enum
    (p_invoice_data->>'net_payable')::NUMERIC,
    p_invoice_data->>'payment_mode',
    (p_invoice_data->>'amount_paid')::NUMERIC,
    (p_invoice_data->>'amount_pending')::NUMERIC,
    p_invoice_data->>'payment_status',
    (p_invoice_data->>'created_by')::UUID,
    (p_invoice_data->>'cgst_5')::NUMERIC,
    (p_invoice_data->>'sgst_5')::NUMERIC,
    (p_invoice_data->>'cgst_18')::NUMERIC,
    (p_invoice_data->>'sgst_18')::NUMERIC,
    (p_invoice_data->>'igst_5')::NUMERIC,
    (p_invoice_data->>'igst_18')::NUMERIC,
    (p_invoice_data->>'customer_id')::UUID
  ) RETURNING id INTO v_invoice_id;

  -- 3. Process Items (Inventory & Line Items)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lock the inventory row specifically for this transaction
    SELECT available_quantity INTO v_current_qty
    FROM barcode_batches
    WHERE barcode_alias_8digit = v_item->>'barcode_8digit'
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
       RAISE EXCEPTION 'Item % not found', v_item->>'barcode_8digit';
    END IF;

    IF v_current_qty < 1 THEN
       RAISE EXCEPTION 'Item % is out of stock', v_item->>'barcode_8digit';
    END IF;

    -- Deduct Inventory
    UPDATE barcode_batches
    SET available_quantity = available_quantity - 1,
        updated_at = NOW()
    WHERE barcode_alias_8digit = v_item->>'barcode_8digit';

    -- Insert Line Item
    INSERT INTO sales_invoice_items (
      invoice_id, sr_no, barcode_8digit, design_no, product_description,
      hsn_code, quantity, mrp, discount, taxable_value,
      gst_percentage, gst_type,
      cgst_percentage, cgst_amount,
      sgst_percentage, sgst_amount,
      igst_percentage, igst_amount,
      total_value, selling_price, salesman_id,
      delivered, delivery_date, expected_delivery_date
    ) VALUES (
      v_invoice_id,
      (v_item->>'sr_no')::INTEGER,
      v_item->>'barcode_8digit',
      v_item->>'design_no',
      v_item->>'product_description',
      v_item->>'hsn_code',
      1,
      (v_item->>'mrp')::NUMERIC,
      (v_item->>'discount')::NUMERIC,
      (v_item->>'taxable_value')::NUMERIC,
      (v_item->>'gst_percentage')::NUMERIC,
      (v_item->>'gst_type')::gst_transaction_type, -- Explicitly cast to enum
      (v_item->>'cgst_percentage')::NUMERIC, (v_item->>'cgst_amount')::NUMERIC,
      (v_item->>'sgst_percentage')::NUMERIC, (v_item->>'sgst_amount')::NUMERIC,
      (v_item->>'igst_percentage')::NUMERIC, (v_item->>'igst_amount')::NUMERIC,
      (v_item->>'total_value')::NUMERIC,
      (v_item->>'selling_price')::NUMERIC,
      (v_item->>'salesman_id')::UUID,
      (v_item->>'delivered')::BOOLEAN,
      (v_item->>'delivery_date')::DATE,
      (v_item->>'expected_delivery_date')::DATE
    );
  END LOOP;

  -- 4. Update Bookings (if applicable)
  UPDATE e_bookings
  SET status = 'invoiced',
      invoice_number = v_invoice_number,
      updated_at = NOW()
  WHERE customer_mobile = p_invoice_data->>'customer_mobile'
  AND status = 'booked'
  AND barcode_8digit IN (
    SELECT value->>'barcode_8digit' FROM jsonb_array_elements(p_items)
  );

  RETURN jsonb_build_object('id', v_invoice_id, 'invoice_number', v_invoice_number);
END;
$$ LANGUAGE plpgsql;
