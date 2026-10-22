import { resolve } from 'node:path';
import type { Column, Database, DatabaseType, Relation, Source } from '@opentyped/odb-db';
import { checks, annotations, sameIdentifier } from '~/sql';

/** node:sqlite DatabaseSync and better-sqlite3 both satisfy this interface. */
export interface SqliteClient {
  prepare(sql: string): { all(...params: string[]): unknown[] };
}

export interface SqliteOptions {
  database: SqliteClient | string;
  schemas?: readonly string[];
  /** Must match the consumer driver's safe-integer configuration. */
  integers?: 'number' | 'bigint';
  watchFiles?: readonly string[];
}

interface TableRow {
  schema: string;
  name: string;
  type: string;
  wr: number;
  strict: number;
}
interface ColumnRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
  hidden: number;
}
interface ForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string | null;
}

const quote = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

function scalar(
  declared: string,
  strict: boolean,
  integer: string,
  rowid: boolean,
  view: boolean,
): string {
  const flexible = [...new Set(['string', 'number', integer, 'Uint8Array'])].join(' | ');
  if (view) {
    return flexible;
  }
  const type = declared.toUpperCase();
  if (rowid || (strict && ['INT', 'INTEGER'].includes(type))) {
    return integer;
  }
  if (strict && type === 'TEXT') {
    return 'string';
  }
  if (strict && type === 'REAL') {
    return 'number';
  }
  if (strict && type === 'BLOB') {
    return 'Uint8Array';
  }
  if (!strict && /CHAR|CLOB|TEXT/.test(type) && !type.includes('INT')) {
    return 'string | Uint8Array';
  }
  return flexible;
}

/** No row sampling: empty databases, generated columns and attached schemas are supported. */
export function readSqlite(
  client: SqliteClient,
  options: Omit<SqliteOptions, 'database'> = {},
): Database {
  const all = <T>(sql: string, ...params: string[]): T[] =>
    client
      .prepare(sql)
      .all(...params)
      .map((row) =>
        Object.fromEntries(
          Object.entries(row as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? Number(value) : value,
          ]),
        ),
      ) as T[];
  const catalog = all<TableRow>('PRAGMA table_list');
  const tables = catalog.filter(
    (table) =>
      !table.name.startsWith('sqlite_') &&
      table.type !== 'shadow' &&
      (!options.schemas || options.schemas.includes(table.schema)),
  );
  const types: DatabaseType[] = [];
  const relations: Relation[] = [];
  const warnings: string[] = [];
  const integer = options.integers ?? 'number';
  for (const table of tables) {
    const fields = all<ColumnRow>(
      'SELECT * FROM pragma_table_xinfo(?, ?) ORDER BY cid',
      table.name,
      table.schema,
    );
    const sql =
      all<{ sql: string | null }>(
        `SELECT sql FROM ${quote(table.schema)}.sqlite_schema WHERE name = ?`,
        table.name,
      )[0]?.sql ?? '';
    const rules = checks(
      sql,
      fields.map((field) => field.name),
    );
    const keys = all<ForeignKey>(
      'SELECT * FROM pragma_foreign_key_list(?, ?) ORDER BY id, seq',
      table.name,
      table.schema,
    );
    const indexes = all<{ origin: string }>(
      'SELECT origin FROM pragma_index_list(?, ?)',
      table.name,
      table.schema,
    );
    const rowid =
      table.type === 'table' &&
      table.wr === 0 &&
      fields.filter((field) => field.pk).length === 1 &&
      !indexes.some((index) => index.origin === 'pk');
    const columns: Column[] = fields
      .filter((field) => field.hidden !== 1)
      .map((field) => {
        const isRowid = rowid && field.pk > 0 && field.type.toUpperCase() === 'INTEGER';
        const id = JSON.stringify([table.schema, table.name, field.name]);
        types.push({
          id,
          schema: 'sqlite',
          name: field.type || 'ANY',
          kind: 'scalar',
          value: {
            select: scalar(
              field.type,
              table.strict === 1 && table.type === 'table',
              integer,
              isRowid,
              table.type === 'view',
            ),
          },
          comment: null,
          annotations: {},
        });
        return {
          name: field.name,
          type: id,
          nullable:
            table.type === 'view' ||
            !(field.notnull || isRowid || (field.pk && (table.wr || table.strict))),
          default: field.dflt_value,
          identity: isRowid ? 'byDefault' : null,
          generated: field.hidden === 2 || field.hidden === 3,
          primaryKey: field.pk > 0,
          references: keys
            .filter((key) => sameIdentifier(key.from, field.name))
            .flatMap((key) => {
              const targetTable =
                catalog.find(
                  (target) =>
                    target.schema === table.schema && sameIdentifier(target.name, key.table),
                )?.name ?? key.table;
              const target = all<ColumnRow>(
                'SELECT * FROM pragma_table_xinfo(?, ?) ORDER BY pk',
                targetTable,
                table.schema,
              );
              const column =
                key.to === null
                  ? target.filter((column) => column.pk > 0)[key.seq]?.name
                  : target.find((column) => sameIdentifier(column.name, key.to!))?.name;
              return column === undefined
                ? []
                : [{ schema: table.schema, relation: targetTable, column }];
            }),
          comment: null,
          annotations:
            table.strict === 1 && field.type.toUpperCase() === 'TEXT'
              ? annotations(rules, field.name)
              : {},
        };
      });
    if (!table.strict && table.type !== 'view') {
      warnings.push(
        `${table.schema}.${table.name}: flexible SQLite storage classes are retained; use STRICT tables or explicit column mappings for narrower types`,
      );
    }
    relations.push({
      schema: table.schema,
      name: table.name,
      kind: table.type === 'view' ? 'view' : 'table',
      columns,
      checks: rules,
      comment: null,
    });
  }
  return { dialect: 'sqlite', types, relations, warnings };
}

export function sqlite(options: SqliteOptions): Source {
  const file =
    typeof options.database === 'string'
      ? options.database === ':memory:'
        ? ':memory:'
        : resolve(options.database)
      : undefined;
  const watchFiles = [
    ...(file && file !== ':memory:' ? [file, `${file}-wal`] : []),
    ...(options.watchFiles ?? []),
  ];
  return {
    watchFiles,
    async read() {
      if (typeof options.database !== 'string') {
        return readSqlite(options.database, options);
      }
      const { DatabaseSync } = await import('node:sqlite');
      const database = new DatabaseSync(file!, { readOnly: true });
      try {
        return readSqlite(database, options);
      } finally {
        database.close();
      }
    },
  };
}
