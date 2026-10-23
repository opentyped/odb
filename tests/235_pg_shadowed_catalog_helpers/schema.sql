CREATE FUNCTION public.obj_description (oid, name) RETURNS text LANGUAGE sql AS $$SELECT 'wrong table comment'$$;

CREATE FUNCTION public.col_description (oid, integer) RETURNS text LANGUAGE sql AS $$SELECT 'wrong column comment'$$;

CREATE FUNCTION public.unnest (anyarray) RETURNS SETOF anyelement LANGUAGE sql AS $$SELECT pg_catalog.unnest($1) WHERE false$$;

CREATE FUNCTION public.json_agg (record) RETURNS json LANGUAGE plpgsql AS $$BEGIN RETURN '[]'::json;END$$;

SET
  search_path = public,
  pg_catalog;

CREATE TABLE sample (
  id integer PRIMARY KEY,
  parent_id integer NOT NULL REFERENCES sample (id)
);

COMMENT ON TABLE sample IS 'Actual table.';

COMMENT ON COLUMN sample.id IS 'Actual ID.';
