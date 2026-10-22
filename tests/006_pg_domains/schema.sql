CREATE DOMAIN label AS varchar(40) NOT NULL CHECK (length(VALUE) >= 2);

CREATE DOMAIN display_label AS label DEFAULT 'new' CHECK (length(VALUE) <= 100);

CREATE TABLE named (label display_label, short label);
