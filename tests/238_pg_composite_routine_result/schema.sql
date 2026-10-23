CREATE TABLE account (id integer PRIMARY KEY, email text NOT NULL);

CREATE TYPE summary AS (total integer, label text);

CREATE FUNCTION active_accounts () RETURNS SETOF account LANGUAGE sql AS $$
  SELECT * FROM account
$$;

CREATE FUNCTION account_summary () RETURNS summary LANGUAGE sql AS $$
  SELECT count(*)::integer, 'all' FROM account
$$;
