CREATE TABLE label (
  "Name" text NOT NULL CHECK (length("Name") >= 3),
  name text NOT NULL CHECK (length(name) <= 5)
);
