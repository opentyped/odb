CREATE TYPE money AS (amount numeric);

CREATE TABLE wallet (value public.money NOT NULL);
