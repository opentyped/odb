CREATE TYPE no_values AS ENUM();

CREATE TABLE impossible (value no_values NOT NULL);
