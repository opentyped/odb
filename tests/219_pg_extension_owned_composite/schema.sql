CREATE EXTENSION citext;

CREATE TYPE extension_payload AS (value citext);

ALTER EXTENSION citext
ADD TYPE extension_payload;

CREATE TABLE t (value integer NOT NULL);
