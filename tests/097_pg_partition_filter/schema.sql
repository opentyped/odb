CREATE TABLE event (id integer PRIMARY KEY, body text)
PARTITION BY
  RANGE (id);

CREATE TABLE event_early PARTITION OF event FOR
VALUES
FROM
  (0) TO (100);
