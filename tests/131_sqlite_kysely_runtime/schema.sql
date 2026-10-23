CREATE TABLE user_profile (
  user_id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0
) STRICT;
