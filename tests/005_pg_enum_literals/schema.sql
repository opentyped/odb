CREATE TYPE mood AS ENUM(
  'ok',
  'quote''d',
  'with space',
  '☃',
  E'line\nbreak',
  ''
);

CREATE TABLE feeling (state mood NOT NULL DEFAULT 'ok', previous mood);
