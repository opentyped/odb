CREATE TABLE computed (
  first text NOT NULL,
  last text,
  full_name text GENERATED ALWAYS AS (first || ' ' || last) STORED
);
