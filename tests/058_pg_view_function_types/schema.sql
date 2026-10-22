CREATE TYPE state AS ENUM('yes', 'no');

CREATE FUNCTION read_state () RETURNS TABLE (status public.state, count bigint, document jsonb) LANGUAGE sql AS $$SELECT 'yes'::public.state,1::bigint,'{}'::jsonb$$;

CREATE VIEW functional AS
SELECT
  *
FROM
  read_state ();

CREATE MATERIALIZED VIEW functional_snapshot AS
SELECT
  *
FROM
  read_state ();
