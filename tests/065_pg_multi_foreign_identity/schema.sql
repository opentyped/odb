CREATE TABLE a (id integer PRIMARY KEY);

CREATE TABLE b (id integer PRIMARY KEY);

CREATE TABLE common (
  id integer PRIMARY KEY REFERENCES a (id),
  FOREIGN KEY (id) REFERENCES b (id)
);

CREATE TABLE reference (
  value integer REFERENCES a (id),
  FOREIGN KEY (value) REFERENCES b (id)
);
