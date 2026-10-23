const sql = String.raw;

/** Catalog reads are deliberately independent of Kysely and schema extraction libraries. */
export const catalog = {
  types: sql`
    SELECT
      t.oid::text AS id,
      n.nspname AS schema,
      t.typname AS name,
      t.typtype AS kind,
      t.typcategory AS category,
      t.typelem::text AS element,
      t.typbasetype::text AS base,
      t.typrelid::text AS relation,
      t.typnotnull AS "notNull",
      t.typdefault AS "default",
      t.typtypmod AS modifier,
      EXISTS (
        SELECT
          1
        FROM
          pg_catalog.pg_depend d
        WHERE
          d.classid = 'pg_catalog.pg_type'::regclass
          AND d.objid = t.oid
          AND d.deptype = 'e'
      ) AS extension,
      pg_catalog.obj_description (t.oid, 'pg_type') AS comment,
      ARRAY(
        SELECT
          e.enumlabel
        FROM
          pg_catalog.pg_enum e
        WHERE
          e.enumtypid = t.oid
        ORDER BY
          e.enumsortorder
      ) AS "values",
      COALESCE(
        (
          SELECT
            r.rngsubtype
          FROM
            pg_catalog.pg_range r
          WHERE
            r.rngtypid = t.oid
            OR r.rngmultitypid = t.oid
          LIMIT
            1
        ),
        0
      )::text AS subtype
    FROM
      pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE
      n.nspname !~ '^pg_(toast|temp)'
      AND t.typisdefined
    ORDER BY
      n.nspname,
      t.typname
  `,
  relations: sql`
    SELECT
      c.oid::text AS id,
      n.nspname AS schema,
      c.relname AS name,
      c.relkind AS kind,
      c.relispartition AS partition,
      ARRAY(
        SELECT
          a.attname
        FROM
          pg_catalog.pg_partitioned_table pt
          CROSS JOIN pg_catalog.unnest (pt.partattrs::INT2[]) AS k (num)
          JOIN pg_catalog.pg_attribute a ON a.attrelid = pt.partrelid
          AND a.attnum = k.num
        WHERE
          pt.partrelid = c.oid
      ) AS "partitionKey",
      pg_catalog.obj_description (c.oid, 'pg_class') AS comment
    FROM
      pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE
      c.relkind IN ('r', 'p', 'v', 'm', 'f', 'c')
      AND n.nspname <> 'information_schema'
      AND n.nspname !~ '^pg_'
    ORDER BY
      n.nspname,
      c.relname
  `,
  columns: sql`
    SELECT
      a.attrelid::text AS relation,
      a.attnum AS position,
      a.attname AS name,
      a.atttypid::text AS type,
      a.attnotnull AS "notNull",
      a.atttypmod AS modifier,
      pg_catalog.pg_get_expr (d.adbin, d.adrelid) AS "default",
      a.attidentity AS identity,
      a.attgenerated <> '' AS generated,
      pg_catalog.col_description (a.attrelid, a.attnum) AS comment
    FROM
      pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid
      AND d.adnum = a.attnum
    WHERE
      a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'c')
      AND n.nspname <> 'information_schema'
      AND n.nspname !~ '^pg_(toast|temp)'
    ORDER BY
      a.attrelid,
      a.attnum
  `,
  routines: sql`
    SELECT
      p.oid::text AS id,
      n.nspname AS schema,
      p.proname AS name,
      p.prokind AS kind,
      p.prorettype::text AS "returnType",
      p.proretset AS "setReturning",
      p.pronargdefaults AS defaults,
      ARRAY(
        SELECT
          arg::text
        FROM
          pg_catalog.unnest (COALESCE(p.proallargtypes, p.proargtypes::oid[])) arg
      ) AS types,
      p.proargnames AS names,
      p.proargmodes::TEXT[] AS modes,
      pg_catalog.pg_get_function_identity_arguments (p.oid) AS signature,
      pg_catalog.obj_description (p.oid, 'pg_proc') AS comment
    FROM
      pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE
      p.prokind IN ('f', 'p')
      AND NOT EXISTS (
        SELECT
          1
        FROM
          pg_catalog.pg_type rt
        WHERE
          rt.oid = p.prorettype
          AND rt.typtype = 'p'
          AND rt.typname IN (
            'trigger',
            'event_trigger',
            'language_handler',
            'fdw_handler',
            'index_am_handler',
            'table_am_handler',
            'tsm_handler',
            'internal',
            'cstring'
          )
      )
      AND n.nspname <> 'information_schema'
      AND n.nspname !~ '^pg_'
      AND NOT EXISTS (
        SELECT
          1
        FROM
          pg_catalog.pg_depend d
        WHERE
          d.classid = 'pg_catalog.pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype IN ('e', 'i')
      )
    ORDER BY
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments (p.oid)
  `,
  partitions: sql`
    SELECT
      i.inhrelid::text AS child,
      i.inhparent::text AS parent
    FROM
      pg_catalog.pg_inherits i
      JOIN pg_catalog.pg_class c ON c.oid = i.inhrelid
    WHERE
      c.relispartition
    ORDER BY
      i.inhrelid
  `,
  views: sql`
    SELECT
      r.ev_class::text AS relation,
      r.ev_action::text AS action
    FROM
      pg_catalog.pg_rewrite r
      JOIN pg_catalog.pg_class c ON c.oid = r.ev_class
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE
      r.rulename = '_RETURN'
      AND c.relkind IN ('v', 'm')
      AND n.nspname <> 'information_schema'
      AND n.nspname !~ '^pg_'
  `,
  constraints: sql`
    SELECT
      con.conrelid::text AS relation,
      con.contypid::text AS type,
      con.conname AS name,
      con.contype AS kind,
      ARRAY(
        SELECT
          a.attname
        FROM
          pg_catalog.unnest (con.conkey) WITH ORDINALITY AS k (num, ord)
          JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid
          AND a.attnum = k.num
        ORDER BY
          k.ord
      ) AS columns,
      pg_catalog.pg_get_expr (con.conbin, con.conrelid) AS expression,
      NOT EXISTS (
        SELECT
          1
        FROM
          pg_catalog.pg_depend d
        WHERE
          d.classid = 'pg_catalog.pg_constraint'::regclass
          AND d.objid = con.oid
          AND d.refclassid IN (
            'pg_catalog.pg_proc'::regclass,
            'pg_catalog.pg_operator'::regclass
          )
      ) AS builtin,
      tn.nspname AS "targetSchema",
      tc.relname AS "targetRelation",
      ARRAY(
        SELECT
          a.attname
        FROM
          pg_catalog.unnest (con.confkey) WITH ORDINALITY AS k (num, ord)
          JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid
          AND a.attnum = k.num
        ORDER BY
          k.ord
      ) AS "targetColumns"
    FROM
      pg_catalog.pg_constraint con
      LEFT JOIN pg_catalog.pg_class tc ON tc.oid = con.confrelid
      LEFT JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
    WHERE
      con.contype IN ('c', 'p', 'f')
    ORDER BY
      con.oid
  `,
};

export interface TypeRow {
  id: string;
  schema: string;
  name: string;
  kind: string;
  category: string;
  element: string;
  base: string;
  relation: string;
  notNull: boolean;
  default: string | null;
  modifier: number;
  extension?: boolean;
  comment: string | null;
  values: string[];
  subtype: string;
}
export interface RelationRow {
  partition: boolean;
  partitionKey: string[];
  id: string;
  schema: string;
  name: string;
  kind: string;
  comment: string | null;
}
export interface ColumnRow {
  relation: string;
  position: number;
  name: string;
  type: string;
  notNull: boolean;
  modifier: number;
  default: string | null;
  identity: string;
  generated: boolean;
  comment: string | null;
}
export interface ConstraintRow {
  builtin?: boolean;
  relation: string;
  type: string;
  name: string;
  kind: string;
  columns: string[];
  expression: string | null;
  targetSchema: string | null;
  targetRelation: string | null;
  targetColumns: string[];
}

/** One statement gives a coherent catalog snapshot even when the client is a pool. */
export const snapshot = `WITH ${Object.entries(catalog)
  .map(([name, sql]) => `odb_${name} AS (${sql})`)
  .join(',\n')}
SELECT ${Object.keys(catalog)
  .map(
    (name) =>
      `(SELECT COALESCE(pg_catalog.json_agg(row), '[]'::json) FROM odb_${name} row) AS "${name}"`,
  )
  .join(',\n')}`;

export interface RoutineRow {
  id: string;
  schema: string;
  name: string;
  kind: 'f' | 'p';
  returnType: string;
  setReturning: boolean;
  defaults: number;
  types: string[];
  names: string[] | null;
  modes: ('i' | 'o' | 'b' | 'v' | 't')[] | null;
  signature: string;
  comment: string | null;
}
