CREATE TABLE array_value (
  integers INTEGER[] NOT NULL,
  matrix INTEGER[] [],
  decimals NUMERIC[] NOT NULL,
  ids BIGINT[],
  flags BOOLEAN[],
  dates date[],
  jsons JSONB[],
  blobs bytea[],
  times TIME[],
  ranges numrange[]
);
