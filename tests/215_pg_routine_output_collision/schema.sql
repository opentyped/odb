CREATE FUNCTION mix () RETURNS TABLE (foo_bar integer, "fooBar" integer) LANGUAGE sql AS $$SELECT 1,2$$;
