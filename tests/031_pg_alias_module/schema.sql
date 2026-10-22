CREATE TYPE monetary AS (amount numeric);

CREATE DOMAIN amount AS numeric NOT NULL;

CREATE TABLE purse (balance monetary NOT NULL, amount amount);
