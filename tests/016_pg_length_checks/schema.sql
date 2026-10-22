CREATE TABLE limited (
  name varchar(10) NOT NULL CHECK (length(name) <= 50) CHECK (char_length(name) > 1),
  exact text NOT NULL CHECK (length(exact) = 5),
  optional text CHECK (
    length(optional) > 3
    OR optional = 'x'
  ),
  impossible text CHECK (length(impossible) < 0)
);
