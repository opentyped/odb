CREATE SCHEMA reporting;

CREATE TABLE event (category text NOT NULL, amount numeric NOT NULL);

CREATE MATERIALIZED VIEW reporting.summary AS
SELECT
  category,
  count(*) AS count,
  sum(amount) AS total,
  jsonb_agg(amount) AS amounts,
  array_agg(category) AS categories
FROM
  event
GROUP BY
  category;
