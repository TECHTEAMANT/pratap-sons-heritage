/*
  # Update Booking Number Format

  ## Changes
  - Update `generate_booking_number()` function to use date-based format
  - New format: EB + DDMMYYYY + sequential number (e.g., EB1102202601, EB1102202602)
  - Sequence resets daily
*/

-- Drop existing function and recreate with new format
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  booking_num TEXT;
  date_str TEXT;
BEGIN
  -- Format: DDMMYYYY
  date_str := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
  
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(booking_number FROM 13) AS INTEGER)), 0) + 1
  INTO next_num
  FROM e_bookings
  WHERE booking_number LIKE 'EB' || date_str || '%';
  
  -- Generate booking number: EB + DDMMYYYY + 2-digit sequence
  booking_num := 'EB' || date_str || LPAD(next_num::TEXT, 2, '0');
  RETURN booking_num;
END;
$$ LANGUAGE plpgsql;
