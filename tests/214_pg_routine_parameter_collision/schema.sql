CREATE FUNCTION mix (foo_bar integer, "fooBar" integer) RETURNS integer LANGUAGE sql AS $$SELECT $1+$2$$;
