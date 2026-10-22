CREATE TABLE document (
  json_value json NOT NULL,
  jsonb_value jsonb,
  jsonb_default jsonb NOT NULL DEFAULT '{}'::jsonb
);
