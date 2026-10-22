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
  ResolvedColumn,
  TypeMapping,
} from '~/schema';

const pascal = (name: string): string =>
  name.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, _prefix, letter: string) =>
    letter.toUpperCase(),
  );
const mapping = (value: string | TypeMapping): TypeMapping =>
  typeof value === 'string' ? { select: value } : value;

export class TypeResolver {
  private readonly types: Map<string, DatabaseType>;

  constructor(
    private readonly database: Database,
    private readonly options: ResolveOptions = {},
  ) {
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
    throw new Error(
      `No mapping for ${type.schema}.${type.name}; configure types[${JSON.stringify(`${type.schema}.${type.name}`)}] for your driver parser`,
    );
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

  column(column: Column, relation: Relation): ResolvedColumn {
    const override = this.options.columns?.[`${relation.schema}.${relation.name}.${column.name}`];
    const value = override === undefined ? this.type(column.type) : mapping(override);
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

        if (!/^[A-Za-z_$][\w$]*$/.test(typeName) || reservedNames.has(typeName)) {
          throw new Error(`Invalid generated type name ${JSON.stringify(typeName)}`);
        }

        // Reserve table names here too, so both generators have the same collision contract.
        for (const name of [typeName, `${typeName}Table`, `New${typeName}`, `${typeName}Update`]) {
          if (reserved.has(name) || names.has(`${relation.schema}:${name}`)) {
            throw new Error(`Generated name collision: ${name}; configure name(relation)`);
          }
          names.add(`${relation.schema}:${name}`);
        }
        const key = isDefault ? relation.name : `${relation.schema}.${relation.name}`;

        if (keys.has(key)) {
          throw new Error(`Database key collision: ${key}`);
        }
        keys.add(key);
        const columns = relation.columns.map((column) => this.column(column, relation));

        if (new Set(columns.map((column) => column.name)).size !== columns.length) {
          throw new Error(`Duplicate columns in ${key}`);
        }

        return { ...relation, typeName, key, columns };
      });

    return this.options.identifiers !== false
      ? { ...this.database, ...identifiers(relations, this.options, names) }
      : { ...this.database, relations, identifiers: [] };
  }
}

export function resolve(database: Database, options: ResolveOptions = {}): ResolvedDatabase {
  return new TypeResolver(database, options).resolve();
}
