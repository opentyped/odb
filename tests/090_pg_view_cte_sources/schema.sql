CREATE TABLE account (id integer PRIMARY KEY);

CREATE VIEW cte AS
WITH
  x AS (
    SELECT
      id
    FROM
      account
  )
SELECT
  id
FROM
  x;

CREATE VIEW nested AS
SELECT
  id
FROM
  (
    SELECT
      id
    FROM
      account
  ) x;

CREATE VIEW renamed AS
WITH
  x (label) AS (
    SELECT
      id
    FROM
      account
  )
SELECT
  label AS key
FROM
  x;

CREATE VIEW recursive AS
WITH RECURSIVE
  x (id) AS (
    SELECT
      id
    FROM
      account
    UNION ALL
    SELECT
      id + 1
    FROM
      x
    WHERE
      id < 2
  )
SELECT
  id
FROM
  x;
