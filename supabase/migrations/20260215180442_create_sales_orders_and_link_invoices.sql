/*
  # Sales Orders System with Invoice Linking

  ## Overview
  This migration creates sales orders system that links to sales invoices and supports advance payments.
  Purchase orders already exist, so we only add order-invoice linking.

  ## New Tables

  ### 1. sales_orders
  - `id` (uuid, primary key)
  - `order_number` (text, unique) - Auto-generated SO number
  - `customer_id` (uuid) - Reference to customers table
  - `order_date` (date) - Date when order was placed
  - `expected_delivery_date` (date) - Expected delivery date
  - `status` (text) - pending, partial, completed, cancelled
  - `total_amount` (decimal) - Total order amount
  - `advance_received` (decimal) - Advance payment received
  - `balance_amount` (decimal) - Remaining balance
  - `notes` (text) - Additional notes
  - `created_by` (uuid) - User who created the order
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. sales_order_items
  - `id` (uuid, primary key)
  - `sales_order_id` (uuid) - Reference to sales_orders
  - `barcode_8digit` (text) - Barcode reference
  - `design_no` (text) - Design number
  - `product_description` (text) - Item description
  - `quantity` (integer) - Ordered quantity
  - `delivered_quantity` (integer) - Quantity delivered so far
  - `selling_price` (decimal) - Price per unit
  - `discount_percentage` (decimal) - Discount %
  - `gst_percentage` (decimal) - GST %
  - `total` (decimal) - Line total
  - `created_at` (timestamptz)

  ### 3. sales_order_advances
  - `id` (uuid, primary key)
  - `sales_order_id` (uuid) - Reference to sales_orders
  - `amount` (decimal) - Advance amount
  - `payment_mode` (text) - cash, card, upi, etc.
  - `payment_date` (date) - Date of payment
  - `reference_number` (text) - Transaction reference
  - `notes` (text) - Payment notes
  - `created_at` (timestamptz)

  ## Modified Tables
  - `sales_invoices` - Add `sales_order_id` column to link invoices to orders

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users
*/

-- Create sales_orders table
CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  total_amount decimal(12,2) NOT NULL DEFAULT 0,
  advance_received decimal(12,2) NOT NULL DEFAULT 0,
  balance_amount decimal(12,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales_order_items table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  barcode_8digit text,
  design_no text,
  product_description text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  delivered_quantity integer NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
  selling_price decimal(10,2) NOT NULL DEFAULT 0,
  discount_percentage decimal(5,2) NOT NULL DEFAULT 0,
  gst_percentage decimal(5,2) NOT NULL DEFAULT 0,
  total decimal(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create sales_order_advances table
CREATE TABLE IF NOT EXISTS sales_order_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_mode text NOT NULL DEFAULT 'Cash',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Add order references to existing invoice tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_invoices' AND column_name = 'sales_order_id'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN sales_order_id uuid REFERENCES sales_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create function to auto-generate sales order numbers
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  order_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 3) AS integer)), 0) + 1
  INTO next_number
  FROM sales_orders
  WHERE order_number ~ '^SO[0-9]+$';
  
  order_number := 'SO' || LPAD(next_number::text, 6, '0');
  RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update sales order status based on delivered quantities
CREATE OR REPLACE FUNCTION update_sales_order_status()
RETURNS trigger AS $$
DECLARE
  total_ordered integer;
  total_delivered integer;
BEGIN
  SELECT 
    SUM(quantity),
    SUM(delivered_quantity)
  INTO total_ordered, total_delivered
  FROM sales_order_items
  WHERE sales_order_id = NEW.sales_order_id;

  IF total_delivered = 0 THEN
    UPDATE sales_orders SET status = 'pending' WHERE id = NEW.sales_order_id;
  ELSIF total_delivered >= total_ordered THEN
    UPDATE sales_orders SET status = 'completed' WHERE id = NEW.sales_order_id;
  ELSE
    UPDATE sales_orders SET status = 'partial' WHERE id = NEW.sales_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_so_status_trigger
AFTER INSERT OR UPDATE ON sales_order_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_status();

-- Create trigger to update sales order advance and balance when advance payment is received
CREATE OR REPLACE FUNCTION update_sales_order_advance()
RETURNS trigger AS $$
DECLARE
  total_advances decimal(12,2);
  order_total decimal(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT total_amount INTO order_total
    FROM sales_orders
    WHERE id = OLD.sales_order_id;

    SELECT COALESCE(SUM(amount), 0) INTO total_advances
    FROM sales_order_advances
    WHERE sales_order_id = OLD.sales_order_id;

    UPDATE sales_orders 
    SET 
      advance_received = total_advances,
      balance_amount = order_total - total_advances
    WHERE id = OLD.sales_order_id;

    RETURN OLD;
  ELSE
    SELECT total_amount INTO order_total
    FROM sales_orders
    WHERE id = NEW.sales_order_id;

    SELECT COALESCE(SUM(amount), 0) INTO total_advances
    FROM sales_order_advances
    WHERE sales_order_id = NEW.sales_order_id;

    UPDATE sales_orders 
    SET 
      advance_received = total_advances,
      balance_amount = order_total - total_advances
    WHERE id = NEW.sales_order_id;

    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_so_advance_trigger
AFTER INSERT OR UPDATE OR DELETE ON sales_order_advances
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_advance();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_so ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_advances_so ON sales_order_advances(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_so ON sales_invoices(sales_order_id);

-- Enable Row Level Security
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_advances ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for sales_orders
CREATE POLICY "Authenticated users can view sales orders"
  ON sales_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales orders"
  ON sales_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales orders"
  ON sales_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales orders"
  ON sales_orders FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for sales_order_items
CREATE POLICY "Authenticated users can view sales order items"
  ON sales_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales order items"
  ON sales_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales order items"
  ON sales_order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales order items"
  ON sales_order_items FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for sales_order_advances
CREATE POLICY "Authenticated users can view sales order advances"
  ON sales_order_advances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales order advances"
  ON sales_order_advances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales order advances"
  ON sales_order_advances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales order advances"
  ON sales_order_advances FOR DELETE
  TO authenticated
  USING (true);

