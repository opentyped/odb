export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** JSON Schema keywords which can be carried into oapi's JSDoc contract. */
export interface Annotations {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  pattern?: string;
  format?: string;
  jsonSchema?: JsonValue;
}

export interface Check {
  name: string;
  expression: string;
  columns: readonly string[];
}

export interface Reference {
  schema: string;
  relation: string;
  column: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  identity: 'always' | 'byDefault' | null;
  generated: boolean;
  primaryKey: boolean;
  references: readonly Reference[];
  comment: string | null;
  annotations: Annotations;
}

export interface Relation {
  schema: string;
  name: string;
  kind: 'table' | 'view' | 'materializedView' | 'foreignTable';
  columns: readonly Column[];
  checks: readonly Check[];
  comment: string | null;
}

interface TypeBase {
  id: string;
  schema: string;
  name: string;
  comment: string | null;
  annotations: Annotations;
}

/** IDs are opaque: adapters must preserve schema-qualified identity separately from display names. */
export type DatabaseType = TypeBase &
  (
    | { kind: 'scalar'; value: TypeMapping | null }
    | { kind: 'enum'; values: readonly string[] }
    | { kind: 'array'; element: string; value?: TypeMapping }
    | {
        kind: 'domain';
        base: string;
        nullable: boolean;
        default: string | null;
        checks: readonly Check[];
      }
    | { kind: 'composite'; columns: readonly Column[]; value: TypeMapping }
    | { kind: 'range' | 'multirange'; element: string; value: TypeMapping }
  );

/** TypeScript expressions reflect the configured application's driver parsers. */
export interface TypeMapping {
  select: string;
  insert?: string;
  update?: string;
  annotations?: Annotations;
}

export interface Database {
  dialect: 'pg' | 'sqlite';
  types: readonly DatabaseType[];
  relations: readonly Relation[];
  warnings: readonly string[];
}

export interface Source {
  read(): Promise<Database>;
  /** Local schema/migration files associated with this source. */
  watchFiles?: readonly string[];
}

export interface ResolveOptions {
  /** Qualified SQL names, e.g. public.monetary. Applied before domain/array expansion. */
  types?: Readonly<Record<string, string | TypeMapping>>;
  /** Qualified schema.table.column names; take precedence over type mappings. */
  columns?: Readonly<Record<string, string | TypeMapping>>;
  /** Brand primary keys and propagate their identifiers through foreign keys. Default: true. */
  identifiers?: boolean;
  /** Unknown extension types fail by default; a fallback must be explicit. */
  unknownType?: string;
  /** Default uses PascalCase within each schema. Collisions are errors. */
  name?: (relation: Relation) => string;
}

export type Identity = string | { schema: string; name: string };

export interface ResolvedColumn extends Column {
  identifiers?: readonly Identity[];
  value: { select: string; insert: string; update: string };
  insertOptional: boolean;
}

export interface ResolvedRelation extends Omit<Relation, 'columns'> {
  typeName: string;
  key: string;
  columns: readonly ResolvedColumn[];
}

export interface Identifier {
  schema: string;
  name: string;
  value: string;
  brand: string;
}

export interface ResolvedDatabase extends Omit<Database, 'relations'> {
  identifiers: readonly Identifier[];
  relations: readonly ResolvedRelation[];
}

export interface Generation {
  /** Ambient modules emitted by this generator; duplicates across generators are errors. */
  modules?: readonly string[];
  /** Exact output paths and contents. Generators do not perform I/O. */
  files: Readonly<Record<string, string>>;
}

export interface Generator {
  name: string;
  files: Readonly<Record<string, string>>;
  generate(database: ResolvedDatabase): Generation | Promise<Generation>;
}

export interface Config extends ResolveOptions {
  source: Source;
  generators: readonly Generator[];
}
