CREATE TABLE account (id integer PRIMARY KEY);

CREATE TABLE note (account_id integer REFERENCES account (id));
