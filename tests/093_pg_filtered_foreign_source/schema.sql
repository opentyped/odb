CREATE TABLE account (id integer PRIMARY KEY);

CREATE TABLE profile (user_id integer NOT NULL REFERENCES account (id));

CREATE TABLE migration (value text);
