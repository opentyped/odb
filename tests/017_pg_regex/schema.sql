CREATE TABLE code (
  portable text NOT NULL CHECK (portable ~ '^item_[0123]+$'),
  dot text CHECK (dot ~ '^a.b$'),
  locale text CHECK (locale ~ '^[a-z]+$'),
  boundary text CHECK (boundary ~ '\mword\M'),
  insensitive text CHECK (insensitive ~* '^abc$')
);

COMMENT ON COLUMN code.portable IS '@pattern ^item_[0123]+$';
