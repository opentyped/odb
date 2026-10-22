CREATE TABLE source (value INTEGER NOT NULL) STRICT;

CREATE VIEW computed AS
SELECT
  CAST(value AS TEXT) AS text_value,
  count(*) AS total,
  sum(value) AS sum,
  json_group_array(value) AS json
FROM
  source;
