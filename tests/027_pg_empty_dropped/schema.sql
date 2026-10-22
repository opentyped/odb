CREATE TABLE empty ();

CREATE TABLE emptied (a integer);

ALTER TABLE emptied
DROP COLUMN a;

CREATE TEMP TABLE hidden (id integer);
