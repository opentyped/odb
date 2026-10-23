CREATE FUNCTION public.length (text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$SELECT 100$$;

SET
  search_path = public,
  pg_catalog;

CREATE TABLE sample (value text NOT NULL CHECK (length(value) >= 10));

INSERT INTO
  sample
VALUES
  ('a');
