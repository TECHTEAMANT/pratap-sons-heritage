/*
  # Fix Ambiguous Column Reference in generate_sales_order_number

  ## Changes
  - Update generate_sales_order_number function to explicitly qualify column names with table name
  - This resolves the "column reference 'order_number' is ambiguous" error

  ## Technical Details
  - The function now uses `sales_orders.order_number` instead of just `order_number`
  - This prevents ambiguity when the function is called in contexts with multiple order_number columns
*/

CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  new_order_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(sales_orders.order_number FROM 3) AS integer)), 0) + 1
  INTO next_number
  FROM sales_orders
  WHERE sales_orders.order_number ~ '^SO[0-9]+$';
  
  new_order_number := 'SO' || LPAD(next_number::text, 6, '0');
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

