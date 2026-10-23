CREATE TABLE foo_parameters (value integer);

CREATE FUNCTION foo () RETURNS integer LANGUAGE sql AS $$SELECT 1$$;
