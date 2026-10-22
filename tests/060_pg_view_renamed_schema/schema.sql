CREATE SCHEMA analytics;

CREATE TABLE source (a integer NOT NULL, b json NOT NULL);

CREATE VIEW analytics.named (identifier, document) AS
SELECT
  a,
  b
FROM
  source;

CREATE MATERIALIZED VIEW analytics.copy AS
SELECT
  *
FROM
  analytics.named;
