CREATE TABLE user_profile (
  user_id integer PRIMARY KEY,
  display_name text NOT NULL,
  created_count integer NOT NULL DEFAULT 0
);
