/*
  # Add active flag to users and allow admins to manage users

  Changes:
  - Ensure users table has an `active` boolean column (default true)
  - Add policies so roles with can_manage_users = true can:
    - Update any user (for role / status changes)
    - Deactivate users (via UPDATE)
*/

-- Add active column if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'active'
  ) THEN
    ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Allow users with can_manage_users permission to update any user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users with manage_users permission can update users'
  ) THEN
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
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.auth_user_id = auth.uid()
          AND r.can_manage_users = true
        )
      );
  END IF;
END $$;

