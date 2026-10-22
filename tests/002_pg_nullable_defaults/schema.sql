CREATE TABLE optional (
  required text NOT NULL,
  nullable integer,
  defaulted boolean NOT NULL DEFAULT FALSE,
  nullable_default numeric DEFAULT 0,
  null_default text NOT NULL DEFAULT NULL
);
