CREATE TABLE users (id integer PRIMARY KEY);

CREATE TABLE profile (
  id integer PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id)
);

CREATE VIEW joined AS
SELECT
  u.id AS left_id,
  p.id AS right_id,
  p.user_id
FROM
  users u
  LEFT JOIN profile p ON p.user_id = u.id;
