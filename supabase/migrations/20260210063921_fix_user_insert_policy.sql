/*
  # Fix User Insert Policy for Self-Registration
  
  This migration adds a policy to allow users to insert their own record
  during the signup process.
  
  Changes:
  - Add policy to allow authenticated users to insert their own user record
  - This enables self-registration functionality
*/

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can read all users" ON users;

-- Allow authenticated users to insert their own user record
CREATE POLICY "Users can create own profile" 
  ON users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = auth_user_id);

-- Allow users to read all users (needed for the app to function)
CREATE POLICY "Authenticated users can read all users" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
  ON users 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = auth_user_id) 
  WITH CHECK (auth.uid() = auth_user_id);
