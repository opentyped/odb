CREATE TYPE state AS ENUM('ready', 'done');

CREATE FUNCTION read_items (min_count integer DEFAULT 0) RETURNS TABLE (id bigint, status state) LANGUAGE sql AS $$SELECT 1::bigint,'ready'::state$$;
