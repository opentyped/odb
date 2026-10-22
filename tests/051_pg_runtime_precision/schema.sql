CREATE SCHEMA billing;

CREATE TABLE parent (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  huge bigint NOT NULL,
  exact numeric(1000, 400) NOT NULL,
  data jsonb NOT NULL,
  typed_data jsonb NOT NULL,
  moment timestamptz NOT NULL,
  bytes bytea NOT NULL
);

CREATE TABLE billing.child (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id integer NOT NULL REFERENCES public.parent (id),
  label text NOT NULL DEFAULT 'new'
);
