/*
  # Add get_email_by_mobile RPC Function

  This migration creates a helper function that allows the login page
  to look up a user's stored email address by their mobile number.
  
  WHY: Supabase Auth uses email+password. We store users with mobile numbers.
  When a user tries to log in with mobile, we need to find their registered
  email (could be a real email or mobile@login.local format) to authenticate.
  
  SECURITY: The function is SECURITY DEFINER so it bypasses RLS, but it only
  returns the email column (no other sensitive data) and only for exact mobile matches.
*/

CREATE OR REPLACE FUNCTION get_email_by_mobile(p_mobile TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM users
  WHERE mobile = p_mobile
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- Allow the function to be called by anonymous (unauthenticated) users
GRANT EXECUTE ON FUNCTION get_email_by_mobile(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_email_by_mobile(TEXT) TO authenticated;
