CREATE SCHEMA alpha;

CREATE SCHEMA beta;

CREATE DOMAIN alpha.code AS text NOT NULL;

CREATE DOMAIN beta.code AS integer NOT NULL;

CREATE TABLE alpha.entry (code alpha.code);

CREATE TABLE beta.entry (code beta.code);
