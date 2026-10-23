CREATE SCHEMA archive;

CREATE TABLE users (id integer PRIMARY KEY)
PARTITION BY
  RANGE (id);

CREATE TABLE archive.users_part PARTITION OF users FOR
VALUES
FROM
  (0) TO (100);

CREATE TABLE archive.profile (user_id integer NOT NULL REFERENCES users (id));
