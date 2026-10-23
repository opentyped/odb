CREATE TABLE author (id integer PRIMARY KEY, name text NOT NULL);

CREATE TABLE book (
  id integer PRIMARY KEY,
  author_id integer NOT NULL REFERENCES author (id)
);

-- PostgreSQL 18 resolves grouped columns through an RTE_GROUP range entry.
CREATE VIEW author_stats AS
SELECT
  a.id,
  a.name,
  count(b.id) AS books
FROM
  author a
  LEFT JOIN book b ON b.author_id = a.id
GROUP BY
  a.id,
  a.name;
