CREATE DOMAIN monetary AS numeric NOT NULL;

CREATE DOMAIN balance AS monetary;

CREATE TABLE wallet (actual balance, replaced balance NOT NULL);
