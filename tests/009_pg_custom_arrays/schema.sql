CREATE TYPE flag AS ENUM('on', 'off');

CREATE TYPE address AS (city text);

CREATE TABLE custom_array (
  flags flag[],
  addresses address[],
  paths int4range[],
  multi int4multirange
);
