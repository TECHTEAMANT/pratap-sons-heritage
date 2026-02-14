/*
  # Create E-Bookings Table and Update Customer Schema

  ## New Tables
  
  ### e_bookings
  - Stores floor-wise item bookings for customers
  - Links to barcode_batches using 8-digit code
  - Tracks booking lifecycle from booked to invoiced
  
  ## Schema Updates
  
  ### customers table
  - Add missing fields: city, pincode, status, last_purchase_date, notes

  ## Security
  - Enable RLS on e_bookings
  - Add policies for authenticated users
*/

-- Update customers table with missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'city'
  ) THEN
    ALTER TABLE customers ADD COLUMN city uuid REFERENCES cities(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'pincode'
  ) THEN
    ALTER TABLE customers ADD COLUMN pincode text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'status'
  ) THEN
    ALTER TABLE customers ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'last_purchase_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_purchase_date date;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'notes'
  ) THEN
    ALTER TABLE customers ADD COLUMN notes text;
  END IF;
END $$;

-- Create e_bookings table
CREATE TABLE IF NOT EXISTS e_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text UNIQUE NOT NULL,
  customer_mobile text NOT NULL,
  barcode_8digit text NOT NULL,
  floor uuid REFERENCES floors(id),
  booking_date timestamptz DEFAULT now(),
  booking_expiry timestamptz,
  status text DEFAULT 'booked' CHECK (status IN ('booked', 'invoiced', 'cancelled', 'expired')),
  invoice_number text,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_customer FOREIGN KEY (customer_mobile) REFERENCES customers(mobile) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE e_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'e_bookings' AND policyname = 'Authenticated users can view e_bookings'
  ) THEN
    CREATE POLICY "Authenticated users can view e_bookings"
      ON e_bookings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'e_bookings' AND policyname = 'Authenticated users can insert e_bookings'
  ) THEN
    CREATE POLICY "Authenticated users can insert e_bookings"
      ON e_bookings FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'e_bookings' AND policyname = 'Authenticated users can update e_bookings'
  ) THEN
    CREATE POLICY "Authenticated users can update e_bookings"
      ON e_bookings FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'e_bookings' AND policyname = 'Authenticated users can delete e_bookings'
  ) THEN
    CREATE POLICY "Authenticated users can delete e_bookings"
      ON e_bookings FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ebookings_customer ON e_bookings(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_ebookings_barcode ON e_bookings(barcode_8digit);
CREATE INDEX IF NOT EXISTS idx_ebookings_status ON e_bookings(status);
CREATE INDEX IF NOT EXISTS idx_ebookings_floor ON e_bookings(floor);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Create function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  booking_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(booking_number FROM 7) AS INTEGER)), 0) + 1
  INTO next_num
  FROM e_bookings
  WHERE booking_number LIKE 'EB' || TO_CHAR(CURRENT_DATE, 'YYYY') || '%';
  
  booking_num := 'EB' || TO_CHAR(CURRENT_DATE, 'YYYY') || LPAD(next_num::TEXT, 6, '0');
  RETURN booking_num;
END;
$$ LANGUAGE plpgsql;

-- Update sales_invoices to link with customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create index on customer_id
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);

-- Update discount_masters with missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_masters' AND column_name = 'discount_code'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN discount_code text UNIQUE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_masters' AND column_name = 'discount_name'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN discount_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_masters' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN discount_value decimal(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_masters' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_masters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE discount_masters ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
