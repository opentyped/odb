CREATE FUNCTION public.jsonb_matches_schema (json, jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$SELECT jsonb_typeof($2) = ($1->>'type')$$;

CREATE TABLE validated (
  data jsonb NOT NULL CHECK (
    public.jsonb_matches_schema ('{"type":"object"}'::json, data)
  )
);
