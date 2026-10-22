CREATE TABLE network(
  id uuid NOT NULL,
  network inet NOT NULL,
  subnet cidr,
  mac macaddr,
  mac64 macaddr8,
  bit_value bit(5),
  varying varbit (9),
  document xml,
  search tsvector,
  query tsquery,
  position pg_lsn,
  oid_value oid NOT NULL
);
