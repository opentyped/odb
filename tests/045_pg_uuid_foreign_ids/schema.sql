CREATE TABLE account (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

CREATE TABLE entry (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES account (id)
);
