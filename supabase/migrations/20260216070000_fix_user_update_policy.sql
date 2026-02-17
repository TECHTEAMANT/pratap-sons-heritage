/*
  # Fix User Update Policy for Admin Role Management

  This migration adds a policy to allow users with 'can_manage_users' permission
  to update other users' profiles (specifically roles).

  Changes:
  - Add policy to allow authorized users to update any user record
*/

CREATE POLICY "Users with manage_users permission can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.can_manage_users = true
    )
  );
