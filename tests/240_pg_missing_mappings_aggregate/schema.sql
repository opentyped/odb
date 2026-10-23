CREATE EXTENSION ltree;

CREATE EXTENSION hstore;

CREATE TABLE node (path ltree NOT NULL, attributes hstore);
