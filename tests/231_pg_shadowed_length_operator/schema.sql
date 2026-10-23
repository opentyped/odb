CREATE FUNCTION public.always_true (integer, integer) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$SELECT true$$;

/* sql-formatter-disable */
CREATE OPERATOR public.>= (
  LEFTARG = integer,
  RIGHTARG = integer,
  FUNCTION = public.always_true
);
/* sql-formatter-enable */
SET
  search_path = public,
  pg_catalog;

CREATE TABLE sample (
  value text NOT NULL CHECK (pg_catalog.length (value) >= 10)
);

INSERT INTO
  sample
VALUES
  ('a');
