CREATE TYPE mood AS ENUM('calm', 'busy');

CREATE DOMAIN code AS varchar(7) NOT NULL;

CREATE TYPE record_value AS (label text, amount numeric);
