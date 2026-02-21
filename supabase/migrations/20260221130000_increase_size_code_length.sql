/*
  # Increase size_code column length

  The size_code column in the sizes table was limited to varchar(2),
  which is too short for codes like "XS(34)", "2XL", "3XL", etc.
  Increasing to varchar(20) to accommodate longer size codes.
*/

ALTER TABLE sizes ALTER COLUMN size_code TYPE character varying(20);
