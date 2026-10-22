CREATE TABLE event (id integer NOT NULL, region text NOT NULL)
PARTITION BY
  LIST (region);

CREATE TABLE event_eu PARTITION OF event FOR
VALUES
  IN ('eu');

CREATE TABLE event_us PARTITION OF event FOR
VALUES
  IN ('us');
