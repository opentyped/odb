CREATE PROCEDURE increment (IN delta integer, INOUT total bigint DEFAULT 0) LANGUAGE plpgsql AS $$BEGIN total:=total+delta;END$$;
