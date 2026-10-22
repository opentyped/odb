CREATE TYPE rating_range AS RANGE (subtype = integer);

CREATE TABLE range_value (
  int_range int4range NOT NULL,
  int8_range int8range,
  num_range numrange,
  timestamps tsrange,
  zoned tstzrange,
  dates daterange,
  custom rating_range,
  many rating_multirange
);
