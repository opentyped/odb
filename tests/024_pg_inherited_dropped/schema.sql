CREATE TABLE parent (id integer NOT NULL, removed text);

CREATE TABLE child (extra boolean DEFAULT TRUE) INHERITS (parent);

ALTER TABLE parent
DROP COLUMN removed;

ALTER TABLE child
ADD COLUMN removed integer;
