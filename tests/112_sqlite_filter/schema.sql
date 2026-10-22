ATTACH DATABASE ':memory:' AS billing;

CREATE TABLE main.hidden (id INTEGER);

CREATE TABLE billing.invoice (id INTEGER NOT NULL) STRICT;
