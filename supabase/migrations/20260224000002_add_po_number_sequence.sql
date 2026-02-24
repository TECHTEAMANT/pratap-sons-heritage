-- Create purchase order sequence table
CREATE TABLE IF NOT EXISTS purchase_order_sequence (
  id integer PRIMARY KEY DEFAULT 1,
  last_number integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Initialize the sequence with the current max number from purchase_orders
-- This handles existing data to prevent duplicate keys
INSERT INTO purchase_order_sequence (id, last_number)
SELECT 1, COALESCE(MAX(NULLIF(regexp_replace(po_number, '\D', '', 'g'), '')::bigint) % 1000000, 0)
FROM purchase_orders
ON CONFLICT (id) DO UPDATE SET last_number = EXCLUDED.last_number;

-- Function to get the next PO number safely
CREATE OR REPLACE FUNCTION get_next_po_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  po_str text;
  current_year text;
BEGIN
  -- Get current year (YYYY)
  current_year := to_char(now(), 'YYYY');

  -- Increment and get next number
  UPDATE purchase_order_sequence 
  SET last_number = last_number + 1,
      updated_at = now()
  WHERE id = 1
  RETURNING last_number INTO next_num;
  
  -- Format as PI + YYYY + 6-digit sequence
  po_str := 'PI' || current_year || LPAD(next_num::text, 6, '0');
  
  RETURN po_str;
END;
$$ LANGUAGE plpgsql;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_next_po_number() TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_po_number() TO anon;
GRANT EXECUTE ON FUNCTION get_next_po_number() TO service_role;
