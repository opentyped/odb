CREATE TABLE computed (
  name TEXT NOT NULL,
  upper_name TEXT GENERATED ALWAYS AS (upper(name)) STORED,
  size INTEGER GENERATED ALWAYS AS (length(name)) VIRTUAL
) STRICT;
