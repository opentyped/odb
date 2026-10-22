CREATE TYPE monetary AS (amount numeric, currency varchar(3));

CREATE TABLE wallet (balance monetary NOT NULL);

CREATE VIEW wallet_view AS
SELECT
  balance
FROM
  wallet;

CREATE MATERIALIZED VIEW wallet_snapshot AS
SELECT
  balance
FROM
  wallet;
