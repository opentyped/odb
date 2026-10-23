CREATE EXTENSION citext;

CREATE TYPE extension_payload AS (value citext);

ALTER EXTENSION citext
ADD TYPE extension_payload;

CREATE TYPE unused_payload AS (value citext);

CREATE FUNCTION unused_function (citext) RETURNS citext LANGUAGE sql AS $$SELECT $1$$;

CREATE TABLE t (value integer NOT NULL);
