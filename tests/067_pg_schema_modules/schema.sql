CREATE SCHEMA billing;

CREATE SCHEMA "sales/region";

CREATE TABLE public.billing_account (id integer PRIMARY KEY);

CREATE TABLE billing.account (
  id integer PRIMARY KEY,
  parent_id integer NOT NULL REFERENCES public.billing_account (id)
);

CREATE TABLE "sales/region".account (
  id integer PRIMARY KEY,
  billing_id integer NOT NULL REFERENCES billing.account (id)
);
