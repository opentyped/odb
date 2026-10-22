CREATE TABLE sample (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amounts NUMERIC[] NOT NULL,
  huge_ids BIGINT[] NOT NULL,
  flags BOOLEAN[] NOT NULL,
  points point NOT NULL,
  circle circle NOT NULL,
  duration interval NOT NULL,
  when_value date NOT NULL,
  jsons JSONB[] NOT NULL
);
