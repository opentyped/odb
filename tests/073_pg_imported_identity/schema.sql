CREATE TABLE account (id text PRIMARY KEY);

CREATE TABLE profile (account_id text NOT NULL REFERENCES account (id));
