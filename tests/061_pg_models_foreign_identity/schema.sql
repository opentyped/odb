CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

CREATE TABLE profiles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id),
  reviewer_id integer REFERENCES users (id)
);

CREATE SCHEMA billing;

CREATE TABLE billing.membership (user_id integer PRIMARY KEY REFERENCES users (id));
