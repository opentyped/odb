CREATE DOMAIN label AS varchar(12) NOT NULL;

CREATE TABLE author (id integer NOT NULL, name label);

CREATE TABLE book (author_id integer);

CREATE VIEW joined AS
SELECT
  a.name
FROM
  book b
  LEFT JOIN author a ON a.id = b.author_id;

CREATE MATERIALIZED VIEW snapshot AS
SELECT
  name
FROM
  joined;
