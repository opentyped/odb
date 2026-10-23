CREATE TABLE payment (
  id integer NOT NULL,
  paid_at timestamptz NOT NULL,
  PRIMARY KEY (id, paid_at)
)
PARTITION BY
  RANGE (paid_at);

CREATE TABLE payment_2026 PARTITION OF payment FOR
VALUES
FROM
  ('2026-01-01') TO ('2027-01-01');

CREATE TABLE refund (
  id integer PRIMARY KEY,
  payment_id integer NOT NULL,
  paid_at timestamptz NOT NULL,
  FOREIGN KEY (payment_id, paid_at) REFERENCES payment (id, paid_at)
);

-- Ordinary composite keys keep one identity per key column.
CREATE TABLE tenant_entry (
  tenant_id integer NOT NULL,
  entry_id integer NOT NULL,
  PRIMARY KEY (tenant_id, entry_id)
);
