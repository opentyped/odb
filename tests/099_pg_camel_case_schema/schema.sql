CREATE SCHEMA audit_log;

CREATE TABLE audit_log.event_log (
  event_id integer NOT NULL,
  created_at text NOT NULL
);
