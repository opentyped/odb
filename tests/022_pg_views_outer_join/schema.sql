CREATE TABLE author (id integer NOT NULL, name text NOT NULL);

CREATE TABLE book (id integer NOT NULL, author_id integer);

CREATE VIEW book_author AS
SELECT
  b.id,
  a.name
FROM
  book b
  LEFT JOIN author a ON a.id = b.author_id;

CREATE MATERIALIZED VIEW author_snapshot AS
SELECT
  id,
  name
FROM
  author;
