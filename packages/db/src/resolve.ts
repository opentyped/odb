import { camelCase, isIdentifier, matches, pascal } from '~/naming';
import { reservedNames } from '~/reserved';
import { mergeAnnotations } from '~/annotation';
import { identifiers } from '~/identifier';
import type {
  Annotations,
  Column,
  Database,
  DatabaseType,
  Relation,
  ResolveOptions,
  ResolvedDatabase,
  ResolvedDefinition,
  ResolvedRoutine,
  ResolvedColumn,
  TypeMapping,
} from '~/schema';

const mapping = (value: string | TypeMapping): TypeMapping =>
  typeof value === 'string' ? { select: value } : value;

function validateMappings(
  names: readonly string[],
  mappings: Readonly<Record<string, unknown>> | undefined,
  kind: string,
): void {
  const seen = new Set<string>();

  for (const name of names) {
    if (seen.has(name) && mappings?.[name] !== undefined) {
      throw new Error(
        `Ambiguous ${kind} mapping ${JSON.stringify(name)}; SQL identifier segments contain dots`,
      );
    }
    seen.add(name);
  }
}

const missingMappings = (names: readonly string[]): string =>
  names
    .map(
      (name) =>
        `No mapping for ${name}; configure types[${JSON.stringify(name)}] for your driver parser`,
    )
    .join('\n');

export class TypeResolver {
  private readonly types: Map<string, DatabaseType>;
  private readonly relations = new Map<string, Relation>();
  /** Set while resolve() runs, so one pass reports every missing mapping. */
  private missing: Set<string> | undefined;
  private readonly columns = new Map<string, Map<string, Column>>();

  constructor(
    private readonly database: Database,
    private readonly options: ResolveOptions = {},
  ) {
    validateMappings(
      database.types.map((type) => `${type.schema}.${type.name}`),
      options.types,
      'type',
    );
    validateMappings(
      database.relations.flatMap((relation) =>
        relation.columns.map((column) => `${relation.schema}.${relation.name}.${column.name}`),
      ),
      options.columns,
      'column',
    );

    for (const relation of database.relations) {
      const key = JSON.stringify([relation.schema, relation.name]);
      this.relations.set(key, relation);
      this.columns.set(key, new Map(relation.columns.map((column) => [column.name, column])));
    }
    this.types = new Map(database.types.map((type) => [type.id, type]));

    if (this.types.size !== database.types.length) {
      throw new Error('Duplicate database type ID');
    }
  }

  private type(id: string, visited = new Set<string>()): TypeMapping {
    const type = this.types.get(id);

    if (!type) {
      throw new Error(`Missing database type ${id}`);
    }
    const custom = this.options.types?.[`${type.schema}.${type.name}`];

    if (custom !== undefined) {
      return mapping(custom);
    }

    if (visited.has(id)) {
      throw new Error(`Cyclic database type ${type.schema}.${type.name}; configure a type mapping`);
    }
    const next = new Set(visited).add(id);

    switch (type.kind) {
      case 'scalar':
        if (type.value) {
          return {
            ...type.value,
            annotations: mergeAnnotations(type.annotations, type.value.annotations),
          };
        }
        break;
      case 'enum':
        return {
          select: type.values.map((value) => JSON.stringify(value)).join(' | ') || 'never',
          annotations: type.annotations,
        };
      case 'domain': {
        const base = this.type(type.base, next);

        return { ...base, annotations: mergeAnnotations(base.annotations, type.annotations) };
      }
      case 'array': {
        if (type.value) {
          return type.value;
        }
        const element = this.type(type.element, next);

        return {
          select: `PgArray<${element.select}>`,
          insert: `PgArray<${element.insert ?? element.select}>`,
          update: `PgArray<${element.update ?? element.insert ?? element.select}>`,
        };
      }
      case 'composite':
      case 'range':
      case 'multirange':
        return {
          ...type.value,
          annotations: mergeAnnotations(type.annotations, type.value.annotations),
        };
    }

    if (this.options.unknownType !== undefined) {
      return { select: this.options.unknownType };
    }
    const name = `${type.schema}.${type.name}`;

    if (this.missing) {
      this.missing.add(name);

      return { select: 'unknown' };
    }
    throw new Error(missingMappings([name]));
  }

  private domain(id: string): { nullable: boolean; default: boolean; annotations: Annotations } {
    let current = this.types.get(id);
    let nullable = true;
    let hasDefault = false;
    const annotations: Annotations[] = [];
    const seen = new Set<string>();
    while (current?.kind === 'domain') {
      if (seen.has(current.id)) {
        throw new Error(`Cyclic domain ${current.schema}.${current.name}`);
      }
      seen.add(current.id);
      nullable &&= current.nullable;
      hasDefault ||= current.default !== null;
      annotations.unshift(current.annotations);
      current = this.types.get(current.base);
    }

    return {
      nullable,
      default: hasDefault,
      annotations: mergeAnnotations(...annotations),
    };
  }

  column(column: Column, relation: Relation, visited = new Set<Column>()): ResolvedColumn {
    const override = this.options.columns?.[`${relation.schema}.${relation.name}.${column.name}`];
    let value: TypeMapping | undefined = override === undefined ? undefined : mapping(override);

    if (column.source && override === undefined && !visited.has(column)) {
      const source = column.source;
      const key = JSON.stringify([source.schema, source.relation]);
      const owner = this.relations.get(key);
      const original = this.columns.get(key)?.get(source.column);
      const base = (id: string): string => {
        const seen = new Set<string>();
        while (this.types.get(id)?.kind === 'domain' && !seen.has(id)) {
          seen.add(id);
          id = (this.types.get(id) as Extract<DatabaseType, { kind: 'domain' }>).base;
        }

        return id;
      };

      if (owner && original && base(original.type) === base(column.type)) {
        const resolved = this.column(original, owner, new Set(visited).add(column));
        value = {
          select:
            resolved.nullable && resolved.value.select !== 'never'
              ? resolved.value.select.slice(1, -8)
              : resolved.value.select,
          annotations: resolved.annotations,
        };
      }
    }
    value ??= this.type(column.type);
    const domain = this.domain(column.type);
    const nullable =
      column.nullable &&
      (relation.kind === 'view' || relation.kind === 'materializedView' || domain.nullable);
    const withNull = (type: string): string =>
      nullable && type !== 'never' ? `(${type}) | null` : type;
    const select = withNull(value.select);
    const readonly = relation.kind === 'view' || relation.kind === 'materializedView';
    const insertOptional =
      column.default !== null || domain.default || nullable || column.identity !== null;
    const insert =
      readonly || column.generated || column.identity === 'always'
        ? 'never'
        : withNull(value.insert ?? value.select);
    const update =
      readonly || column.generated || column.identity === 'always'
        ? 'never'
        : withNull(value.update ?? value.insert ?? value.select);

    return {
      ...column,
      ...(this.options.camelCase ? { propertyName: camelCase(column.name) } : {}),
      nullable,
      annotations: mergeAnnotations(domain.annotations, value.annotations, column.annotations),
      insertOptional,
      value: {
        select,
        insert: insertOptional && insert !== 'never' ? `(${insert}) | undefined` : insert,
        update,
      },
    };
  }

  resolve(): ResolvedDatabase {
    this.missing = new Set();

    try {
      const database = this.resolveAll();

      if (this.missing.size) {
        throw new Error(missingMappings([...this.missing].sort()));
      }

      return database;
    } finally {
      this.missing = undefined;
    }
  }

  private resolveAll(): ResolvedDatabase {
    const reserved = new Set([
      'Database',
      'JsonValue',
      'PgArray',
      'ColumnType',
      'Selectable',
      'Insertable',
      'Updateable',
      'Date',
      'Array',
      'Uint8Array',
      'Exclude',
    ]);
    const visible = (relation: { schema: string; name: string; exported?: boolean }): boolean => {
      const name = `${relation.schema}.${relation.name}`;

      return (
        relation.exported !== false &&
        (this.options.include === undefined || matches(name, this.options.include)) &&
        !matches(name, this.options.exclude ?? [])
      );
    };
    const required = new Set<Column>(
      this.database.relations.filter(visible).flatMap((relation) => relation.columns),
    );
    const pending = [...required];

    for (const column of pending) {
      for (const reference of [...column.references, ...(column.source ? [column.source] : [])]) {
        const key = JSON.stringify([reference.schema, reference.relation]);
        const target = this.columns.get(key)?.get(reference.column);

        if (target && !required.has(target)) {
          required.add(target);
          pending.push(target);
        }
      }
    }
    const names = new Set<string>();
    const keys = new Set<string>();
    const relations = [...this.database.relations]
      .sort((a, b) =>
        `${a.schema}.${a.name}` < `${b.schema}.${b.name}`
          ? -1
          : `${a.schema}.${a.name}` > `${b.schema}.${b.name}`
            ? 1
            : 0,
      )
      .map((relation) => {
        const isDefault = relation.schema === (this.database.dialect === 'pg' ? 'public' : 'main');
        const typeName = this.options.name?.(relation) ?? pascal(relation.name);

        if (visible(relation) && (!isIdentifier(typeName) || reservedNames.has(typeName))) {
          throw new Error(`Invalid generated type name ${JSON.stringify(typeName)}`);
        }

        // Reserve table names here too, so both generators have the same collision contract.
        for (const name of [typeName, `${typeName}Table`, `New${typeName}`, `${typeName}Update`]) {
          if (
            visible(relation) &&
            (reserved.has(name) || names.has(`${relation.schema}:${name}`))
          ) {
            throw new Error(`Generated name collision: ${name}; configure name(relation)`);
          }

          if (visible(relation)) {
            names.add(`${relation.schema}:${name}`);
          }
        }
        const tableKey = isDefault ? relation.name : `${relation.schema}.${relation.name}`;
        const key = this.options.camelCase
          ? isDefault
            ? camelCase(relation.name)
            : `${camelCase(relation.schema)}.${camelCase(relation.name)}`
          : tableKey;

        if (visible(relation) && keys.has(key)) {
          throw new Error(`Database key collision: ${key}`);
        }

        if (visible(relation)) {
          keys.add(key);
        }
        const columns = relation.columns.map((column) =>
          required.has(column)
            ? this.column(column, relation)
            : {
                ...column,
                value: { select: 'unknown', insert: 'never', update: 'never' },
                insertOptional: false,
              },
        );

        if (
          visible(relation) &&
          new Set(columns.map((column) => column.propertyName ?? column.name)).size !==
            columns.length
        ) {
          throw new Error(`Duplicate columns in ${key}`);
        }

        return { ...relation, typeName, key, columns };
      });

    const populated =
      this.options.identifiers !== false
        ? identifiers(relations, this.options, names, visible)
        : { relations, identifiers: [] };
    const selected = populated.relations.filter(visible);
    const used = selected.flatMap((relation) =>
      relation.columns.flatMap((column) => column.identifiers ?? []),
    );
    const exportedIdentifiers = populated.identifiers.filter((identifier) =>
      used.some(
        (identity) =>
          typeof identity !== 'string' &&
          identity.schema === identifier.schema &&
          identity.name === identifier.name,
      ),
    );

    const definitions: ResolvedDefinition[] = this.database.types
      .filter((type) => type.exported && visible(type))
      .map((type) => {
        const name = this.options.typeName?.(type) ?? pascal(type.name);

        if (
          !isIdentifier(name) ||
          reservedNames.has(name) ||
          reserved.has(name) ||
          names.has(`${type.schema}:${name}`)
        ) {
          throw new Error(
            `Generated SQL type name collision: ${type.schema}.${name}; configure typeName(type)`,
          );
        }
        names.add(`${type.schema}:${name}`);
        const value = this.type(type.id);
        const definition: ResolvedDefinition = {
          schema: type.schema,
          name,
          kind: type.kind,
          comment: type.comment,
          annotations: mergeAnnotations(type.annotations, value.annotations),
          value,
        };

        if (type.kind === 'composite') {
          const companion = `${name}Value`;

          if (names.has(`${type.schema}:${companion}`)) {
            throw new Error(
              `Generated SQL type name collision: ${type.schema}.${companion}; configure typeName(type)`,
            );
          }
          names.add(`${type.schema}:${companion}`);
          definition.fields = type.columns.map((column) =>
            this.column(column, {
              schema: type.schema,
              name: type.name,
              kind: 'table',
              columns: type.columns,
              checks: [],
              comment: type.comment,
            }),
          );

          if (
            new Set(definition.fields.map((field) => field.propertyName ?? field.name)).size !==
            definition.fields.length
          ) {
            throw new Error(`Duplicate fields in SQL type ${type.schema}.${name}Value`);
          }
        }

        return definition;
      });

    const inputRoutines = (this.database.routines ?? []).filter(visible);
    const routines: ResolvedRoutine[] = inputRoutines.map((routine) => {
      const overloads = inputRoutines.filter(
        (entry) => entry.schema === routine.schema && entry.name === routine.name,
      );
      const overload = overloads.indexOf(routine) + 1;
      const name =
        this.options.routineName?.(routine, overload) ??
        `${pascal(routine.name)}${overloads.length > 1 ? overload : ''}`;

      for (const suffix of [
        'Parameters',
        'Result',
        ...(routine.setReturning ? ['Rows'] : []),
        ...(routine.kind === 'function' &&
        routine.parameters.filter((parameter) => ['o', 'b'].includes(parameter.mode)).length ===
          1 &&
        !routine.parameters.some((parameter) => parameter.mode === 't')
          ? ['Row']
          : []),
      ]) {
        const exported = `${name}${suffix}`;

        if (
          !isIdentifier(exported) ||
          reservedNames.has(exported) ||
          reserved.has(exported) ||
          names.has(`${routine.schema}:${exported}`)
        ) {
          throw new Error(
            `Generated routine name collision: ${routine.schema}.${exported}; configure routineName(routine, overload)`,
          );
        }
        names.add(`${routine.schema}:${exported}`);
      }
      const value = (type: string, input: boolean): string => {
        const mapped = this.type(type);
        const selected = input ? (mapped.insert ?? mapped.select) : mapped.select;

        return this.domain(type).nullable && selected !== 'unknown' && selected !== 'JsonValue'
          ? `(${selected}) | null`
          : selected;
      };
      const outputs = routine.parameters.filter((parameter) =>
        ['o', 'b', 't'].includes(parameter.mode),
      );
      const returned = this.types.get(routine.returnType);
      // Like RETURNS TABLE, a composite result expands to its attributes in FROM.
      const composite =
        !outputs.length && returned?.kind === 'composite'
          ? returned.columns.map((column) => ({ name: column.name, type: column.type }))
          : [];
      const fields = [...outputs, ...composite].map((parameter) => ({
        name: this.options.camelCase ? camelCase(parameter.name) : parameter.name,
        value: value(parameter.type, false),
      }));

      const parameters = routine.parameters
        .filter((parameter) => !['o', 't'].includes(parameter.mode))
        .map((parameter) => ({
          name: this.options.camelCase ? camelCase(parameter.name) : parameter.name,
          value: value(parameter.type, true),
          optional: parameter.optional,
        }));

      if (new Set(parameters.map((parameter) => parameter.name)).size !== parameters.length) {
        throw new Error(`Duplicate parameters in routine ${routine.schema}.${routine.name}`);
      }

      if (new Set(fields.map((field) => field.name)).size !== fields.length) {
        throw new Error(`Duplicate output fields in routine ${routine.schema}.${routine.name}`);
      }
      const singleOut =
        routine.kind === 'function' &&
        outputs.length === 1 &&
        !routine.parameters.some((parameter) => parameter.mode === 't');

      return {
        schema: routine.schema,
        name,
        signature: routine.signature,
        comment: routine.comment,
        setReturning: routine.setReturning,
        parameters,
        result:
          routine.kind === 'procedure' && !fields.length
            ? 'void'
            : value(routine.returnType, false),
        ...(fields.length ? (singleOut ? { rowFields: fields } : { fields }) : {}),
      };
    });

    return {
      ...this.database,
      routines,
      definitions,
      relations: selected,
      identifiers: exportedIdentifiers,
    };
  }
}

export function resolve(database: Database, options: ResolveOptions = {}): ResolvedDatabase {
  return new TypeResolver(database, options).resolve();
}
