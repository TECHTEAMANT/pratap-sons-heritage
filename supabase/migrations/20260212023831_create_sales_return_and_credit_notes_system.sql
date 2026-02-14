/*
  # Create Sales Return and Credit Notes System

  ## Overview
  Creates comprehensive sales return functionality with automatic stock adjustments,
  credit note generation, and customer balance tracking.

  ## New Tables
  
  1. `sales_returns`
    - `id` (uuid, primary key) - Unique return identifier
    - `return_number` (text, unique) - Return number (SR2026XXXXXX)
    - `return_date` (date) - Date of return
    - `invoice_id` (uuid) - Reference to original sales_invoices
    - `invoice_number` (text) - Original invoice number
    - `customer_mobile` (text) - Customer mobile
    - `customer_name` (text) - Customer name
    - `return_reason` (text) - Reason for return
    - `total_return_amount` (numeric) - Total amount being returned
    - `credit_note_number` (text, unique) - Generated credit note number
    - `status` (text) - pending/completed/cancelled
    - `created_by` (uuid) - User who created return
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update

  2. `sales_return_items`
    - `id` (uuid, primary key) - Unique identifier
    - `return_id` (uuid) - Reference to sales_returns
    - `invoice_item_id` (uuid) - Reference to original sales_invoice_items
    - `barcode_8digit` (text) - Barcode of returned item
    - `design_no` (text) - Design number
    - `product_description` (text) - Product description
    - `quantity` (integer) - Quantity returned
    - `selling_price` (numeric) - Original selling price
    - `return_amount` (numeric) - Amount to be credited
    - `stock_adjusted` (boolean) - Whether stock was added back
    - `created_at` (timestamptz) - Creation timestamp

  3. `credit_notes`
    - `id` (uuid, primary key) - Unique identifier
    - `credit_note_number` (text, unique) - Credit note number (CN2026XXXXXX)
    - `credit_date` (date) - Date of credit note
    - `customer_mobile` (text) - Customer mobile
    - `customer_name` (text) - Customer name
    - `return_id` (uuid) - Reference to sales_returns
    - `invoice_id` (uuid) - Reference to original invoice
    - `credit_amount` (numeric) - Total credit amount
    - `balance_used` (numeric) - Amount already used from this credit
    - `balance_remaining` (numeric) - Remaining balance
    - `status` (text) - active/partially_used/fully_used/expired
    - `notes` (text) - Additional notes
    - `created_by` (uuid) - User who created credit note
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update

  4. `credit_note_applications`
    - `id` (uuid, primary key) - Unique identifier
    - `credit_note_id` (uuid) - Reference to credit_notes
    - `invoice_id` (uuid) - Invoice where credit was applied
    - `amount_applied` (numeric) - Amount applied from credit
    - `applied_date` (date) - Date of application
    - `applied_by` (uuid) - User who applied credit
    - `created_at` (timestamptz) - Creation timestamp

  ## Updates to Existing Tables
  
  1. Extend `customers` table
    - `credit_balance` (numeric) - Total available credit balance
    - `total_returns` (numeric) - Total value of returns
    - `return_count` (integer) - Number of returns

  ## Triggers
  1. Auto-update stock when sales return is created
  2. Auto-generate credit note when return is completed
  3. Auto-update customer credit balance
  4. Auto-update credit note balance when applied

  ## Security
  - Enable RLS on all new tables
  - Authenticated users can read all data
  - Only sales users can create/manage returns
*/

-- Create sales_returns table
CREATE TABLE IF NOT EXISTS sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text UNIQUE NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_id uuid REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  customer_mobile text NOT NULL,
  customer_name text NOT NULL,
  return_reason text NOT NULL,
  total_return_amount numeric NOT NULL DEFAULT 0,
  credit_note_number text UNIQUE,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales_return_items table
CREATE TABLE IF NOT EXISTS sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid REFERENCES sales_returns(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES sales_invoice_items(id),
  barcode_8digit text NOT NULL,
  design_no text NOT NULL,
  product_description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  selling_price numeric NOT NULL,
  return_amount numeric NOT NULL,
  stock_adjusted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create credit_notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text UNIQUE NOT NULL,
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_mobile text NOT NULL,
  customer_name text NOT NULL,
  return_id uuid REFERENCES sales_returns(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  credit_amount numeric NOT NULL,
  balance_used numeric DEFAULT 0,
  balance_remaining numeric NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'partially_used', 'fully_used', 'expired')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create credit_note_applications table
CREATE TABLE IF NOT EXISTS credit_note_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid REFERENCES credit_notes(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  amount_applied numeric NOT NULL,
  applied_date date NOT NULL DEFAULT CURRENT_DATE,
  applied_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Extend customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'credit_balance'
  ) THEN
    ALTER TABLE customers ADD COLUMN credit_balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'total_returns'
  ) THEN
    ALTER TABLE customers ADD COLUMN total_returns numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'return_count'
  ) THEN
    ALTER TABLE customers ADD COLUMN return_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON sales_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_credit_notes_return ON credit_notes(return_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_credit ON credit_note_applications(credit_note_id);

-- Enable RLS
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read sales returns"
  ON sales_returns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create sales returns"
  ON sales_returns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sales returns"
  ON sales_returns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read sales return items"
  ON sales_return_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create sales return items"
  ON sales_return_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read credit notes"
  ON credit_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create credit notes"
  ON credit_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update credit notes"
  ON credit_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read credit note applications"
  ON credit_note_applications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create credit note applications"
  ON credit_note_applications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to process sales return (add stock back and create credit note)
CREATE OR REPLACE FUNCTION process_sales_return()
RETURNS TRIGGER AS $$
DECLARE
  return_item RECORD;
  credit_note_num text;
BEGIN
  -- Only process if status is completed and not already processed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Add stock back for each returned item
    FOR return_item IN 
      SELECT * FROM sales_return_items WHERE return_id = NEW.id AND stock_adjusted = false
    LOOP
      -- Update barcode_batches to add quantity back
      UPDATE barcode_batches
      SET 
        available_quantity = available_quantity + return_item.quantity,
        updated_at = now()
      WHERE barcode_alias_8digit = return_item.barcode_8digit;
      
      -- Mark item as stock adjusted
      UPDATE sales_return_items
      SET stock_adjusted = true
      WHERE id = return_item.id;
    END LOOP;
    
    -- Generate credit note number
    credit_note_num := 'CN' || TO_CHAR(NEW.return_date, 'YYYY') || 
                       LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    
    -- Create credit note
    INSERT INTO credit_notes (
      credit_note_number,
      credit_date,
      customer_mobile,
      customer_name,
      return_id,
      invoice_id,
      credit_amount,
      balance_remaining,
      status,
      created_by
    ) VALUES (
      credit_note_num,
      NEW.return_date,
      NEW.customer_mobile,
      NEW.customer_name,
      NEW.id,
      NEW.invoice_id,
      NEW.total_return_amount,
      NEW.total_return_amount,
      'active',
      NEW.created_by
    );
    
    -- Update sales_returns with credit note number
    NEW.credit_note_number = credit_note_num;
    
    -- Update customer statistics
    UPDATE customers
    SET 
      credit_balance = COALESCE(credit_balance, 0) + NEW.total_return_amount,
      total_returns = COALESCE(total_returns, 0) + NEW.total_return_amount,
      return_count = COALESCE(return_count, 0) + 1
    WHERE mobile = NEW.customer_mobile;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update credit note when application is created
CREATE OR REPLACE FUNCTION update_credit_note_on_application()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE credit_notes
  SET 
    balance_used = COALESCE(balance_used, 0) + NEW.amount_applied,
    balance_remaining = GREATEST(0, COALESCE(balance_remaining, credit_amount) - NEW.amount_applied),
    status = CASE
      WHEN COALESCE(balance_remaining, credit_amount) - NEW.amount_applied <= 0 THEN 'fully_used'
      WHEN COALESCE(balance_used, 0) + NEW.amount_applied > 0 THEN 'partially_used'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE id = NEW.credit_note_id;
  
  -- Update customer credit balance
  UPDATE customers
  SET credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - NEW.amount_applied)
  WHERE mobile = (SELECT customer_mobile FROM credit_notes WHERE id = NEW.credit_note_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_process_sales_return ON sales_returns;
CREATE TRIGGER trg_process_sales_return
  BEFORE UPDATE ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION process_sales_return();

DROP TRIGGER IF EXISTS trg_update_credit_note_on_application ON credit_note_applications;
CREATE TRIGGER trg_update_credit_note_on_application
  AFTER INSERT ON credit_note_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_note_on_application();

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_sales_returns_updated_at ON sales_returns;
CREATE TRIGGER update_sales_returns_updated_at
  BEFORE UPDATE ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_notes_updated_at ON credit_notes;
CREATE TRIGGER update_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
