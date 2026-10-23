CREATE FUNCTION echo (anyelement) RETURNS anyelement LANGUAGE sql AS $$SELECT $1$$;
