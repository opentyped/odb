CREATE DOMAIN monetary AS numeric;

CREATE TABLE amounts (
  VALUES
    monetary[] NOT NULL
);
