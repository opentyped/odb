CREATE TABLE "a[b" (id integer PRIMARY KEY);

CREATE VIEW "v[b" AS
WITH
  "x[y" AS (
    SELECT
      id
    FROM
      "a[b"
  )
SELECT
  id
FROM
  "x[y";

CREATE VIEW "brace{view" AS
SELECT
  id
FROM
  "a[b";
