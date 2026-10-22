CREATE DOMAIN monetary AS numeric NOT NULL DEFAULT 0;

CREATE DOMAIN amount AS monetary;

CREATE TABLE ledger (amount amount);
