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
  /** Partition routing column, including keys inherited from partitioned ancestors. */
  partitionKey?: boolean;
  references: readonly Reference[];
  /** Unchanged source column of a view or partition parent, proven by the adapter. */
  source?: Reference;
  comment: string | null;
  annotations: Annotations;
}

export interface Relation {
  /** False retains dependency metadata without exporting this relation. */
  exported?: boolean;
  schema: string;
  name: string;
  kind: 'table' | 'view' | 'materializedView' | 'foreignTable';
  columns: readonly Column[];
  checks: readonly Check[];
  comment: string | null;
}

interface TypeBase {
  /** Export this user-defined SQL type, including when unused by tables. */
  exported?: boolean;
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

export interface RoutineParameter {
  name: string;
  type: string;
  mode: 'i' | 'o' | 'b' | 'v' | 't';
  optional: boolean;
}

export interface Routine {
  id: string;
  schema: string;
  name: string;
  signature: string;
  kind: 'function' | 'procedure';
  parameters: readonly RoutineParameter[];
  returnType: string;
  setReturning: boolean;
  comment: string | null;
}

export interface ResolvedRoutine {
  schema: string;
  name: string;
  signature: string;
  comment: string | null;
  parameters: readonly { name: string; value: string; optional: boolean }[];
  result: string;
  fields?: readonly { name: string; value: string }[];
  rowFields?: readonly { name: string; value: string }[];
  setReturning: boolean;
}

export interface Database {
  routines?: readonly Routine[];
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
  /** Match schema-qualified SQL relation, type, and routine names. Supports * and ?. */
  include?: readonly string[];
  exclude?: readonly string[];
  /** Match the standard Kysely CamelCasePlugin names; configure that plugin at runtime. */
  camelCase?: boolean;
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
  typeName?: (type: DatabaseType) => string;
  routineName?: (routine: Routine, overload: number) => string;
}

export type Identity = string | { schema: string; name: string };

export interface ResolvedColumn extends Column {
  propertyName?: string;
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

export interface ResolvedDefinition {
  schema: string;
  name: string;
  kind: DatabaseType['kind'];
  comment: string | null;
  annotations: Annotations;
  value: TypeMapping;
  fields?: readonly ResolvedColumn[];
}

export interface ResolvedDatabase extends Omit<Database, 'relations' | 'routines'> {
  routines: readonly ResolvedRoutine[];
  definitions: readonly ResolvedDefinition[];
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
