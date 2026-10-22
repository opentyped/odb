import { mergeAnnotations } from '@opentyped/odb-db';
import type {
  Annotations,
  Check,
  Column,
  Database,
  DatabaseType,
  Relation,
  Source,
} from '@opentyped/odb-db';
import {
  snapshot,
  type ColumnRow,
  type ConstraintRow,
  type RelationRow,
  type TypeRow,
} from '~/catalog';
import { builtin, parsedArrays } from '~/mapping';
import { lengthConstraints } from '~/constraint';

/** Accepts pg.Client, pg.Pool, and compatible query clients without a driver dependency. */
export interface PgClient {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface PgOptions {
  client: PgClient;
  schemas?: readonly string[];
  watchFiles?: readonly string[];
}

const checks = (rows: readonly ConstraintRow[]): Check[] =>
  rows
    .filter((row) => row.kind === 'c' && row.expression !== null)
    .map((row) => ({ name: row.name, expression: row.expression!, columns: row.columns }));

/** Reads catalogs in one statement. Caller owns the connection lifecycle. */
export async function readPostgres(
  client: PgClient,
  options: Omit<PgOptions, 'client'> = {},
): Promise<Database> {
  const result = (await client.query(snapshot)).rows[0];
  if (!result) {
    throw new Error('PostgreSQL catalog query returned no result');
  }
  const { types, relations, columns, constraints } = result as unknown as {
    types: TypeRow[];
    relations: RelationRow[];
    columns: ColumnRow[];
    constraints: ConstraintRow[];
  };
  const typesById = new Map(types.map((type) => [type.id, type]));
  const modifierAnnotations = (id: string, modifier: number): Annotations => {
    const type = typesById.get(id);
    if (
      type?.schema === 'pg_catalog' &&
      ['varchar', 'bpchar'].includes(type.name) &&
      modifier >= 4
    ) {
      return { maxLength: modifier - 4 };
    }
    return {};
  };
  const convertColumns = (id: string): Column[] => {
    const rules = constraints.filter((constraint) => constraint.relation === id);
    const relationChecks = checks(rules);
    return columns
      .filter((column) => column.relation === id)
      .map((column) => ({
        name: column.name,
        type: column.type,
        nullable: !column.notNull,
        default: column.default,
        identity: column.identity === 'a' ? 'always' : column.identity === 'd' ? 'byDefault' : null,
        generated: column.generated,
        primaryKey: rules.some((rule) => rule.kind === 'p' && rule.columns.includes(column.name)),
        references: rules
          .filter((rule) => rule.kind === 'f' && rule.columns.includes(column.name))
          .map((rule) => ({
            schema: rule.targetSchema!,
            relation: rule.targetRelation!,
            column: rule.targetColumns[rule.columns.indexOf(column.name)]!,
          })),
        comment: column.comment,
        annotations: mergeAnnotations(
          modifierAnnotations(column.type, column.modifier),
          lengthConstraints(relationChecks, column.name),
        ),
      }));
  };
  const definitions: DatabaseType[] = types.map((type): DatabaseType => {
    const base = {
      id: type.id,
      schema: type.schema,
      name: type.name,
      comment: type.comment,
      annotations: {},
    };
    if (type.kind === 'e') {
      return { ...base, kind: 'enum', values: type.values };
    }
    if (type.kind === 'd') {
      const rules = checks(constraints.filter((rule) => rule.type === type.id));
      return {
        ...base,
        kind: 'domain',
        base: type.base,
        nullable: !type.notNull,
        default: type.default,
        checks: rules,
        annotations: mergeAnnotations(
          modifierAnnotations(type.base, type.modifier),
          lengthConstraints(rules, 'VALUE'),
        ),
      };
    }
    if (type.category === 'A' && type.element !== '0') {
      return {
        ...base,
        kind: 'array',
        element: type.element,
        ...(type.schema === 'pg_catalog' && type.name === '_numeric'
          ? { value: { select: 'PgArray<number>', insert: 'PgArray<string | number>' } }
          : !(type.schema === 'pg_catalog' && parsedArrays.has(type.name))
            ? { value: { select: 'string' } }
            : {}),
      };
    }
    if (type.kind === 'c') {
      return {
        ...base,
        kind: 'composite',
        columns: convertColumns(type.relation),
        value: { select: 'string' },
      };
    }
    if (type.kind === 'r' || type.kind === 'm') {
      return {
        ...base,
        kind: type.kind === 'r' ? 'range' : 'multirange',
        element: type.subtype,
        value: { select: 'string' },
      };
    }
    return {
      ...base,
      kind: 'scalar',
      value: type.schema === 'pg_catalog' ? builtin(type.name) : null,
    };
  });
  const output: Relation[] = relations
    .filter(
      (relation) =>
        relation.kind !== 'c' && (!options.schemas || options.schemas.includes(relation.schema)),
    )
    .map((relation) => ({
      schema: relation.schema,
      name: relation.name,
      kind:
        relation.kind === 'v'
          ? 'view'
          : relation.kind === 'm'
            ? 'materializedView'
            : relation.kind === 'f'
              ? 'foreignTable'
              : 'table',
      columns: convertColumns(relation.id),
      checks: checks(constraints.filter((rule) => rule.relation === relation.id)),
      comment: relation.comment,
    }));
  return { dialect: 'pg', types: definitions, relations: output, warnings: [] };
}

export function postgres(options: PgOptions): Source {
  return {
    read: () => readPostgres(options.client, options),
    ...(options.watchFiles ? { watchFiles: options.watchFiles } : {}),
  };
}
