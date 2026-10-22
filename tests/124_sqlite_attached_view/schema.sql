ATTACH DATABASE ':memory:' AS analytics;

CREATE TABLE analytics.source (value INTEGER NOT NULL) STRICT;

CREATE VIEW analytics.named (result) AS
SELECT
  value
FROM
  source;

CREATE TEMP VIEW cross_schema AS
SELECT
  value
FROM
  analytics.source;
