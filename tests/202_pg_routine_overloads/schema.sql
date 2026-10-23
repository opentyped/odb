CREATE FUNCTION lookup (value integer, prefix text DEFAULT '') RETURNS text LANGUAGE sql AS $$SELECT prefix||value::text$$;

CREATE FUNCTION lookup (value text) RETURNS text LANGUAGE sql AS $$SELECT value$$;
