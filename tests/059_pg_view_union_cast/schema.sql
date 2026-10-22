CREATE VIEW union_value AS
SELECT
  NULL::varchar(8) AS label,
  ARRAY[NULL::integer] AS
VALUES
UNION ALL
SELECT
  'value'::varchar(8),
  ARRAY[1, 2];
