CREATE TABLE users (id integer PRIMARY KEY);

CREATE TABLE profile (user_id integer NOT NULL REFERENCES users (id));
