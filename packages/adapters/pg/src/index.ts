import { viewSources } from '~/view';
import { mergeAnnotations } from '@opentyped/odb-db';
import type {
  Annotations,
  Check,
  Column,
  Database,
  DatabaseType,
  Relation,
  Source,
  Reference,
} from '@opentyped/odb-db';
import {
  snapshot,
  type ColumnRow,
  type ConstraintRow,
  type RelationRow,
  type TypeRow,
  type RoutineRow,
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
  /** Include partition children. Default true, preserving existing scans. */
  partitions?: boolean;
  watchFiles?: readonly string[];
}

/** Only pinned builtins have no replaceable function/operator dependencies. */
const builtinChecks = (rows: readonly ConstraintRow[]): Check[] =>
  checks(rows.filter((row) => row.builtin !== false));

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
  const { types, relations, columns, constraints, views, routines, partitions } =
    result as unknown as {
      partitions: { child: string; parent: string }[];
      routines: RoutineRow[];
      views: { relation: string; action: string }[];
      types: TypeRow[];
      relations: RelationRow[];
      columns: ColumnRow[];
      constraints: ConstraintRow[];
    };
  const relationsById = new Map(relations.map((relation) => [relation.id, relation]));
  const columnsByRelation = new Map<string, ColumnRow[]>();
  const columnsByName = new Map<string, Map<string, ColumnRow>>();
  const constraintsByRelation = new Map<string, ConstraintRow[]>();
  const constraintsByType = new Map<string, ConstraintRow[]>();
  for (const column of columns) {
    const grouped = columnsByRelation.get(column.relation) ?? [];
    grouped.push(column);
    columnsByRelation.set(column.relation, grouped);
    const named = columnsByName.get(column.relation) ?? new Map<string, ColumnRow>();
    named.set(column.name, column);
    columnsByName.set(column.relation, named);
  }
  for (const constraint of constraints) {
    for (const [index, key] of [
      [constraintsByRelation, constraint.relation],
      [constraintsByType, constraint.type],
    ] as const) {
      const grouped = index.get(key) ?? [];
      grouped.push(constraint);
      index.set(key, grouped);
    }
  }
  const parents = new Map(partitions.map((partition) => [partition.child, partition.parent]));
  const warnings: string[] = [];
  const origins = new Map<string, Reference>();
  for (const column of columns) {
    const relation = relationsById.get(column.relation);
    if (relation) {
      origins.set(`${column.relation}:${column.position}`, {
        schema: relation.schema,
        relation: relation.name,
        column: column.name,
      });
    }
  }
  const provenance = new Map(
    views.map((view) => {
      const parsed = viewSources(view.action, origins);
      if (parsed.warning) {
        warnings.push(`${view.relation}: ${parsed.warning}`);
      }
      return [view.relation, parsed.sources];
    }),
  );
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
  const stringType = (id: string): boolean => {
    const visited = new Set<string>();
    let type = typesById.get(id);
    while (type?.kind === 'd' && !visited.has(type.id)) {
      visited.add(type.id);
      type = typesById.get(type.base);
    }
    return (
      type?.kind === 'e' ||
      (type?.schema === 'pg_catalog' &&
        ['text', 'varchar', 'bpchar', 'char', 'name'].includes(type.name))
    );
  };
  const partitionKeys = (id: string): Set<string> => {
    const keys = new Set<string>();
    const visited = new Set<string>();
    for (let current: string | undefined = id; current && !visited.has(current);) {
      visited.add(current);
      for (const name of relationsById.get(current)?.partitionKey ?? []) {
        keys.add(name);
      }
      current = parents.get(current);
    }
    return keys;
  };
  const convertColumns = (id: string): Column[] => {
    const rules = constraintsByRelation.get(id) ?? [];
    const relationChecks = builtinChecks(rules);
    const routing = partitionKeys(id);
    return (columnsByRelation.get(id) ?? []).map((column) => ({
      ...(routing.has(column.name) ? { partitionKey: true } : {}),
      ...(() => {
        const parentId = parents.get(id);
        const parent = parentId ? relationsById.get(parentId) : undefined;
        const original = parentId ? columnsByName.get(parentId)?.get(column.name) : undefined;
        const source =
          parent && original
            ? { schema: parent.schema, relation: parent.name, column: original.name }
            : provenance.get(id)?.get(column.position);
        return source ? { source } : {};
      })(),
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
        stringType(column.type) ? lengthConstraints(relationChecks, column.name) : {},
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
      ...(['e', 'd', 'r', 'm'].includes(type.kind) ||
      (type.kind === 'c' && relationsById.get(type.relation)?.kind === 'c')
        ? {
            exported:
              !type.extension &&
              !['pg_catalog', 'information_schema'].includes(type.schema) &&
              (!options.schemas || options.schemas.includes(type.schema)),
          }
        : {}),
    };
    if (type.kind === 'e') {
      return { ...base, kind: 'enum', values: type.values };
    }
    if (type.kind === 'd') {
      const rules = checks(constraintsByType.get(type.id) ?? []);
      return {
        ...base,
        kind: 'domain',
        base: type.base,
        nullable: !type.notNull,
        default: type.default,
        checks: rules,
        annotations: mergeAnnotations(
          modifierAnnotations(type.base, type.modifier),
          stringType(type.base)
            ? lengthConstraints(builtinChecks(constraintsByType.get(type.id) ?? []), 'VALUE')
            : {},
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
    .filter((relation) => relation.kind !== 'c')
    .map((relation) => ({
      ...((options.schemas && !options.schemas.includes(relation.schema)) ||
      (options.partitions === false && relation.partition)
        ? { exported: false }
        : {}),
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
      checks: checks(constraintsByRelation.get(relation.id) ?? []),
      comment: relation.comment,
    }));
  return {
    dialect: 'pg',
    types: definitions,
    relations: output,
    warnings,
    routines: routines
      .filter((routine) => !options.schemas || options.schemas.includes(routine.schema))
      .map((routine) => {
        const inputCount = routine.types.filter(
          (_, index) => !['o', 't'].includes(routine.modes?.[index] ?? 'i'),
        ).length;
        let inputIndex = 0;
        const names = new Set(routine.names?.filter(Boolean) ?? []);

        return {
          ...routine,
          kind: routine.kind === 'p' ? 'procedure' : 'function',
          parameters: routine.types.map((type, index) => {
            const mode = routine.modes?.[index] ?? 'i';
            const input = !['o', 't'].includes(mode);
            const optional =
              input && (++inputIndex > inputCount - routine.defaults || mode === 'v');
            let name = routine.names?.[index];
            if (!name) {
              name = `arg${index + 1}`;
              while (names.has(name)) {
                name = `_${name}`;
              }
              names.add(name);
            }
            return { name, type, mode, optional };
          }),
        };
      }),
  };
}

export function postgres(options: PgOptions): Source {
  return {
    read: () => readPostgres(options.client, options),
    ...(options.watchFiles ? { watchFiles: options.watchFiles } : {}),
  };
}
