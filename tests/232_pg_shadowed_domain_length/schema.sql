CREATE FUNCTION public.length (text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$SELECT 100$$;

SET
  search_path = public,
  pg_catalog;

CREATE DOMAIN code AS text CHECK (length(VALUE) >= 10);

CREATE TABLE sample (value code NOT NULL);

INSERT INTO
  sample
VALUES
  ('a');
