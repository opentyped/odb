CREATE SCHEMA billing;

CREATE TYPE public.currency AS ENUM('usd', 'eur');

CREATE TABLE public.hidden (id integer);

CREATE TABLE billing.invoice (currency public.currency NOT NULL);
