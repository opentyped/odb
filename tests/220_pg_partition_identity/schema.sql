CREATE SCHEMA archive;

CREATE TABLE account (id integer PRIMARY KEY)
PARTITION BY
  RANGE (id);

CREATE TABLE archive.account_part PARTITION OF account FOR
VALUES
FROM
  (0) TO (100)
PARTITION BY
  RANGE (id);

CREATE TABLE archive.account_leaf PARTITION OF archive.account_part FOR
VALUES
FROM
  (0) TO (50);

CREATE TABLE profile (user_id integer NOT NULL REFERENCES account (id));
