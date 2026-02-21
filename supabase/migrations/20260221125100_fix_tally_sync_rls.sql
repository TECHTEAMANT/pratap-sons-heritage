/*
  # Fix Row Level Security for tally_sync table

  The tally_sync table has RLS enabled but no policy allowing inserts.
  This migration adds a permissive policy for authenticated users.
*/

-- Allow authenticated users to do everything on tally_sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tally_sync' AND policyname = 'Allow authenticated users full access'
  ) THEN
    CREATE POLICY "Allow authenticated users full access"
      ON tally_sync
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Also allow anon read access if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tally_sync' AND policyname = 'Allow anon read access'
  ) THEN
    CREATE POLICY "Allow anon read access"
      ON tally_sync
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
