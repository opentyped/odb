CREATE TABLE account (id integer PRIMARY KEY);

CREATE VIEW changed AS
SELECT
  id + 0 AS calculated,
  id::bigint AS casted,
  coalesce(id, 0) AS fallback,
  CASE
    WHEN id > 0 THEN id
    ELSE 0
  END AS chosen,
  id
FROM
  account;
