CREATE TABLE tenant (id integer PRIMARY KEY);

CREATE TABLE entry (
  tenant_id integer REFERENCES tenant (id),
  entry_id integer,
  PRIMARY KEY (tenant_id, entry_id)
);

CREATE TABLE link (
  tenant_id integer,
  entry_id integer,
  FOREIGN KEY (tenant_id, entry_id) REFERENCES entry (tenant_id, entry_id)
);
