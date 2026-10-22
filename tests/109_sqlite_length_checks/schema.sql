CREATE TABLE limited (
  name TEXT NOT NULL CHECK (length(name) > 1) CHECK (length(name) <= 20),
  exact TEXT CHECK (length(exact) = 4),
  optional TEXT CHECK (
    length(optional) > 10
    OR optional = 'x'
  )
) STRICT;
