CREATE EXTENSION citext;

CREATE TYPE hidden_payload AS (value citext);

CREATE DOMAIN hidden_domain AS citext;

CREATE TYPE hidden_enum AS ENUM('a');

CREATE FUNCTION hidden_function (citext) RETURNS citext LANGUAGE sql AS $$SELECT $1$$;

CREATE TABLE t (value integer NOT NULL);
