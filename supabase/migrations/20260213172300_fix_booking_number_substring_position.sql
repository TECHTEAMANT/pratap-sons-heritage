/*
  # Fix Booking Number Generation - Correct Substring Position

  ## Changes
  - Fix the SUBSTRING position calculation in generate_booking_number()
  - Format: EB + DDMMYYYY + 2-digit sequence (e.g., EB1302202601)
  - Positions: EB (1-2), DDMMYYYY (3-10), sequence (11-12)
  - Correct SUBSTRING should be FROM 11, not FROM 13
  
  ## Security
  - No RLS changes needed
*/

-- Fix the booking number generation function with correct substring position
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
  -- Booking format: EB + DDMMYYYY (10 chars) + 2-digit sequence
  -- So sequence starts at position 11
  SELECT COALESCE(
    MAX(CAST(NULLIF(SUBSTRING(booking_number FROM 11), '') AS INTEGER)),
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