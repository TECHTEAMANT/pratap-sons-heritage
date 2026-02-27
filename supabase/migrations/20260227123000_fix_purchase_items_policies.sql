-- Add DELETE policy for purchase_items to fix accumulation bug
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Authenticated SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_items' 
    AND policyname = 'Authenticated users can select purchase items'
  ) THEN
    CREATE POLICY "Authenticated users can select purchase items"
      ON purchase_items FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Authenticated INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_items' 
    AND policyname = 'Authenticated users can insert purchase items'
  ) THEN
    CREATE POLICY "Authenticated users can insert purchase items"
      ON purchase_items FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Authenticated UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_items' 
    AND policyname = 'Authenticated users can update purchase items'
  ) THEN
    CREATE POLICY "Authenticated users can update purchase items"
      ON purchase_items FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Authenticated DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_items' 
    AND policyname = 'Authenticated users can delete purchase items'
  ) THEN
    CREATE POLICY "Authenticated users can delete purchase items"
      ON purchase_items FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
