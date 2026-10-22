CREATE TABLE big_key (id bigint PRIMARY KEY);

CREATE TABLE small_reference (id integer REFERENCES big_key (id));
