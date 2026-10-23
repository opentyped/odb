CREATE SCHEMA api;

CREATE TABLE account (id integer PRIMARY KEY);

CREATE VIEW api.account AS
SELECT
  id
FROM
  public.account;
