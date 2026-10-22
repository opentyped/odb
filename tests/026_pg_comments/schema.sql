CREATE TABLE documented (name varchar(10) NOT NULL, value text);

COMMENT ON TABLE documented IS 'Documentation.';

COMMENT ON COLUMN documented.name IS E'A name.\n@minLength 2';

COMMENT ON COLUMN documented.value IS E'Comment with */ termination.\n@required true';
