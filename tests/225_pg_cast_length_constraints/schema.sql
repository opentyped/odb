CREATE TABLE measured (
  value integer NOT NULL CHECK (length(value::text) <= 4),
  bytes bytea NOT NULL CHECK (length(bytes::text) <= 20),
  text_value text NOT NULL CHECK (length(text_value) <= 8)
);
