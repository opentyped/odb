CREATE TYPE money_value AS (amount numeric, currency varchar(3));

CREATE TYPE asset AS (label text, money money_value);

CREATE TABLE seed (value text);

CREATE TABLE holder (money money_value, asset asset, row_value seed);
