CREATE DOMAIN amount AS numeric NOT NULL;

CREATE DOMAIN amount_alias AS amount;

CREATE TABLE total (value amount_alias NOT NULL);
