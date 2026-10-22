CREATE TYPE monetary AS (amount numeric, currency text);

CREATE TABLE invoice (balance monetary NOT NULL, paid monetary);

CREATE VIEW invoice_view AS
SELECT
  balance
FROM
  invoice;
