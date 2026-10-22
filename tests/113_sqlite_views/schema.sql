CREATE TABLE account (id INTEGER NOT NULL, name TEXT NOT NULL) STRICT;

CREATE VIEW account_view AS
SELECT
  id,
  name
FROM
  account;

CREATE VIEW expression_view AS
SELECT
  1 + 1 AS count,
  'CHECK(fake)' AS label;
