ATTACH DATABASE ':memory:' AS billing;

CREATE TABLE main.account (id INTEGER NOT NULL) STRICT;

CREATE TABLE billing.account (id INTEGER NOT NULL) STRICT;

CREATE TEMP TABLE scratch (value TEXT);
