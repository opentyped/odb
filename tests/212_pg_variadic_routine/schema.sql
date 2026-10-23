CREATE FUNCTION sum_args (VARIADIC items INTEGER[]) RETURNS bigint LANGUAGE sql AS $$SELECT sum(value) FROM unnest(items) AS value$$;
