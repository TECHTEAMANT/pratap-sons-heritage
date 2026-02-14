/*
  # Fix Booking Number Generation Function

  ## Changes
  - Fix the `generate_booking_number()` function to handle empty result sets correctly
  - The issue was SUBSTRING returning empty string when no bookings exist, which fails INTEGER casting
  - Use NULLIF to convert empty strings to NULL before casting
  
  ## Security
  - No RLS changes needed
*/

-- Fix the booking number generation function
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  booking_num TEXT;
  date_str TEXT;
  max_num TEXT;
BEGIN
  -- Format: DDMMYYYY
  date_str := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
  
  -- Get the next sequence number for today
  -- Use NULLIF to convert empty string to NULL before casting
  SELECT COALESCE(
    MAX(CAST(NULLIF(SUBSTRING(booking_number FROM 13), '') AS INTEGER)),
    0
  ) + 1
  INTO next_num
  FROM e_bookings
  WHERE booking_number LIKE 'EB' || date_str || '%';
  
  -- If next_num is still null (shouldn't happen due to COALESCE, but be safe), default to 1
  next_num := COALESCE(next_num, 1);
  
  -- Generate booking number: EB + DDMMYYYY + 2-digit sequence
  booking_num := 'EB' || date_str || LPAD(next_num::TEXT, 2, '0');
  RETURN booking_num;
END;
$$ LANGUAGE plpgsql;