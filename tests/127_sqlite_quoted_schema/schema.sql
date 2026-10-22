ATTACH DATABASE ':memory:' AS "sales/east";

CREATE TABLE "sales/east"."user record" (value TEXT NOT NULL) STRICT;

CREATE TEMP TABLE "user record" (value TEXT NOT NULL) STRICT;
