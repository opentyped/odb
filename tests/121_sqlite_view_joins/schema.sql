CREATE TABLE author (id INTEGER NOT NULL, name TEXT NOT NULL) STRICT;

CREATE TABLE book (id INTEGER NOT NULL, author_id INTEGER) STRICT;

CREATE VIEW book_author AS
SELECT
  b.id,
  a.name
FROM
  book b
  LEFT JOIN author a ON a.id = b.author_id;
