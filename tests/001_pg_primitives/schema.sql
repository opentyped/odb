CREATE TABLE primitive (
  small smallint NOT NULL,
  ordinary integer NOT NULL,
  huge bigint NOT NULL,
  exact numeric(1000, 500) NOT NULL,
  approximate real NOT NULL,
  precise double precision NOT NULL,
  enabled boolean NOT NULL,
  fixed char(5) NOT NULL,
  variable varchar(15) NOT NULL,
  content text NOT NULL
);
