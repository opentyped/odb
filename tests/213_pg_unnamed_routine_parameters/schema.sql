CREATE FUNCTION naming (integer, arg1 text) RETURNS text LANGUAGE sql AS $$SELECT $2||$1::text$$;
