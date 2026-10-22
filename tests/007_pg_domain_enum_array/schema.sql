CREATE TYPE status AS ENUM('open', 'closed');

CREATE DOMAIN status_kind AS status NOT NULL DEFAULT 'open';

CREATE DOMAIN label_list AS TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE domain_value (status status_kind, labels label_list);
