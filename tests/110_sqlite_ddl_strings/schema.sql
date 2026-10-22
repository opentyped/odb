CREATE TABLE tricky (
  value TEXT CHECK (
    length(value) > 1
    OR value = 'x'
  ),
  note TEXT DEFAULT 'CHECK(fake)',
  CONSTRAINT valid CHECK (length(note) <= 20)
) STRICT;

-- CHECK(ignored)
/* CHECK(comment) */
