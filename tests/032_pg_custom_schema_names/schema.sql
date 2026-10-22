CREATE SCHEMA billing;

CREATE TYPE public.money AS (amount numeric);

CREATE TYPE billing.money AS (cents bigint);

CREATE TABLE public.wallet (value public.money NOT NULL);

CREATE TABLE billing.wallet (value billing.money NOT NULL);
