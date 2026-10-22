CREATE TABLE account (id integer PRIMARY KEY);

CREATE TABLE entry (account_id integer REFERENCES account (id));
