CREATE DOMAIN monetary AS numeric(80, 30) NOT NULL;

CREATE DOMAIN balance AS monetary;

CREATE TABLE ledger (amount balance NOT NULL);

CREATE VIEW ledger_view AS
SELECT
  amount
FROM
  ledger;

CREATE MATERIALIZED VIEW ledger_snapshot AS
SELECT
  amount
FROM
  ledger;
