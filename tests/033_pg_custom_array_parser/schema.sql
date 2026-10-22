CREATE TYPE flag AS ENUM('on', 'off');

CREATE TABLE flag_set (flags flag[] NOT NULL);
