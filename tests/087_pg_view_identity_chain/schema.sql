CREATE TABLE account (id integer PRIMARY KEY);

CREATE VIEW account_view AS
SELECT
  id
FROM
  account;

CREATE VIEW account_copy AS
SELECT
  id
FROM
  account_view;

CREATE MATERIALIZED VIEW account_mat AS
SELECT
  id
FROM
  account_copy;
