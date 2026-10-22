CREATE TYPE public.money AS (amount numeric);

CREATE TABLE shadow (
  priced money NOT NULL,
  custom public.money NOT NULL
);
