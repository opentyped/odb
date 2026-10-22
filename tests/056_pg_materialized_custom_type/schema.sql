CREATE TYPE monetary AS (amount numeric, currency text);

CREATE TABLE account (balance monetary NOT NULL);

CREATE VIEW account_view AS
SELECT
  balance
FROM
  account;

CREATE MATERIALIZED VIEW account_snapshot AS
SELECT
  balance
FROM
  account_view;
