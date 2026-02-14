/*
  # Add Customer Update Trigger for Sales Invoices

  ## Changes
  - Create function to update customer data when sales invoice is created
  - Updates:
    - loyalty_points_balance (adds earned points, subtracts redeemed points)
    - total_purchases (adds invoice net_payable)
    - total_visits (increments by 1)
    - last_purchase_date (sets to invoice date)
  - Create trigger to call function on INSERT

  ## Security
  - Function runs with SECURITY DEFINER to bypass RLS
*/

-- Create function to update customer data
CREATE OR REPLACE FUNCTION update_customer_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer data based on the sale
  UPDATE customers
  SET
    loyalty_points_balance = COALESCE(loyalty_points_balance, 0) + 
                             COALESCE(NEW.loyalty_points_earned, 0) - 
                             COALESCE(NEW.loyalty_points_redeemed, 0),
    total_purchases = COALESCE(total_purchases, 0) + COALESCE(NEW.net_payable, 0),
    total_visits = COALESCE(total_visits, 0) + 1,
    last_purchase_date = NEW.invoice_date,
    updated_at = NOW()
  WHERE mobile = NEW.customer_mobile;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_customer_on_sale ON sales_invoices;

CREATE TRIGGER trigger_update_customer_on_sale
AFTER INSERT ON sales_invoices
FOR EACH ROW
EXECUTE FUNCTION update_customer_on_sale();
