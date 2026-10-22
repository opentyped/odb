CREATE TYPE state AS ENUM('open', 'closed');

CREATE TABLE source (
  id integer NOT NULL,
  state state NOT NULL,
  body jsonb NOT NULL
);

CREATE VIEW derived AS
SELECT
  id::bigint AS huge,
  upper(state::text) AS label,
  body -> 'nested' AS payload,
  ARRAY[id] AS ids,
  state AS status
FROM
  source;
