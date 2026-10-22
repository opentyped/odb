CREATE SCHEMA billing;

CREATE DOMAIN public.monetary AS numeric NOT NULL;

CREATE DOMAIN billing.monetary AS numeric NOT NULL;

CREATE TABLE wallet (amount public.monetary);

CREATE TABLE billing.wallet (amount billing.monetary);
