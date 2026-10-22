CREATE TYPE monetary AS (amount numeric);

CREATE DOMAIN amount_value AS monetary NOT NULL;

CREATE TABLE expense (amount amount_value);
