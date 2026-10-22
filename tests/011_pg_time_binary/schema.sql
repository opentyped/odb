CREATE TABLE temporal (
  DAY date NOT NULL,
  moment timestamp NOT NULL,
  zoned timestamptz NOT NULL,
  clock time NOT NULL,
  clock_zone timetz,
  elapsed interval,
  bytes bytea
);
