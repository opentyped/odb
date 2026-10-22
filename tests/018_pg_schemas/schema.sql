CREATE SCHEMA billing;

CREATE SCHEMA audit;

CREATE TABLE public.account (id integer PRIMARY KEY);

CREATE TABLE billing.account (
  id uuid PRIMARY KEY,
  account_id integer NOT NULL REFERENCES public.account (id)
);

CREATE TABLE audit.entry (
  id bigint PRIMARY KEY,
  account_id uuid REFERENCES billing.account (id)
);
