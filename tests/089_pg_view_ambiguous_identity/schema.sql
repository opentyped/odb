CREATE TABLE a (id integer PRIMARY KEY);

CREATE TABLE b (id integer PRIMARY KEY);

CREATE VIEW joined AS
SELECT
  id,
  a.id AS a_id,
  b.id AS b_id
FROM
  a
  FULL JOIN b USING (id);

CREATE VIEW united AS
SELECT
  id
FROM
  a
UNION
SELECT
  id
FROM
  b;

CREATE VIEW wrapped AS
SELECT
  id
FROM
  (
    SELECT
      id
    FROM
      a
    UNION ALL
    SELECT
      id
    FROM
      b
  ) x;
