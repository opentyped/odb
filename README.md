# odb

Database-first TypeScript definitions for the OpenTyped workspace. Scan an existing PostgreSQL or SQLite database once, resolve its types once, and give the populated model to independent generators.

| Workspace                  | Package                          | Responsibility                                                                                     |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/db`              | `@opentyped/odb-db`              | Database model, type resolution, generator contract. No runtime dependencies or filesystem access. |
| `packages/adapters/pg`     | `@opentyped/odb-adapters-pg`     | PostgreSQL catalog scan through a supplied query client.                                           |
| `packages/adapters/sqlite` | `@opentyped/odb-adapters-sqlite` | SQLite introspection through `node:sqlite` or a supplied compatible client.                        |
| `packages/models`          | `@opentyped/odb-models`          | Pure selected model interfaces with schema annotations.                                            |
| `packages/kysely`          | `@opentyped/odb-kysely`          | Kysely table interfaces and a `Database` interface.                                                |

Package names use `odb-` to coexist with oapi's `@opentyped/vite` and other OpenTyped packages. Adapters depend on `db`; generators depend on `db`; `db` never imports a driver or generator. File writing lives in the separate `@opentyped/odb-db/write` entry point.

Requires Node >=22.13. SQLite introspection requires SQLite >=3.37 (`table_list`, strict-table metadata). The PostgreSQL scanner targets PostgreSQL >=14.

```sh
npm install
npm run check
npm run example
```

The runnable SQLite example produces [`models.d.ts`](examples/sqlite/generated/models.d.ts) and [`kysely.d.ts`](examples/sqlite/generated/kysely.d.ts). Tests use a real PostgreSQL engine through PGlite, real SQLite, real Kysely types, and script-driven regeneration.

## Generate from PostgreSQL

Install `pg` in the consuming application. A `pg.Client` or `pg.Pool` satisfies the adapter's small query interface; the adapter never closes a supplied connection.

```ts
import pg from 'pg';
import { generate } from '@opentyped/odb-db';
import { postgres } from '@opentyped/odb-adapters-pg';
import { models } from '@opentyped/odb-models';
import { kysely } from '@opentyped/odb-kysely';
import { writeFiles } from '@opentyped/odb-db/write';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await generate({
    source: postgres({ client: pool, schemas: ['public', 'billing'] }),
    identifiers: true,
    types: {
      'public.monetary': {
        select: "import('@app/types').Monetary",
        insert: 'string',
      },
      'public.asset': "import('@app/types').Asset",
      'public.ltree': 'string',
    },
    generators: [
      models({ files: { declarations: 'src/generated/models.d.ts' }, prefix: 'odb' }),
      kysely({ files: { declarations: 'src/generated/kysely.d.ts' }, prefix: 'odb/kysely' }),
    ],
  });
  await writeFiles(result);
} finally {
  await pool.end();
}
```

`import type { Account } from 'odb/public'` selects the pure model. `import type { AccountTable } from 'odb/kysely/public'` provides table types. Import the complete `Database` from `odb/kysely`. Each schema also exports `Account = Selectable<AccountTable>`, `NewAccount = Insertable<AccountTable>`, and `AccountUpdate = Updateable<AccountTable>`. Every model has the same selected shape as `Selectable<Database[table]>`. Nullable fields remain required properties. Defaults affect inserts; generated columns and always-generated identities reject inserts and updates. Views and materialized views have `never` write types. Kysely rejects field updates, but an all-`never` insert shape becomes `{}`, so TypeScript cannot prohibit every view insert; the database enforces view write permissions.

Each generator writes one ambient `.d.ts` file with separate module declarations per database schema. Include both files in the consuming tsconfig. Models default to `odb/<schema>`, Kysely tables to `odb/kysely/<schema>`. Override `prefix` to choose different paths. `public`, `main`, and `temp` are explicit namespaces; schema names are URI-encoded as a single path segment. Model and ID names stay local to their schema, so `odb/public` and `odb/billing` can both export `Account` and `AccountId`. Cross-schema foreign keys reference the source ID through its module path.

The root `odb/kysely` module exports the combined `Database` with SQL table keys (`account`, `billing.account`); it does not flatten schema types into the root. Schema modules export table definitions and aliases; the combined `Database` is exported once from the root module. SQLite attached databases use the same module structure (`odb/main`, `odb/billing`, `odb/temp`).

`types` maps exact qualified SQL names before domain/array expansion. `columns` maps exact `schema.table.column` names and takes precedence. Mappings accept a TypeScript expression or `{ select, insert?, update?, annotations? }`. Use package imports or application aliases for imported custom types; relative import expressions are relative to each output file. The application must configure matching runtime parsers. Unsupported extension scalar types fail unless explicitly mapped or `unknownType` is supplied.

`identifiers` defaults to `true` and emits branded primary-key aliases. Foreign keys with matching selected representations reuse the target identifier; primary keys that also reference another primary key share an identity. Composite keys get one alias per independent key column; partition-key columns that PostgreSQL forces into a composite primary key route rows rather than identify them, so they stay unbranded. Explicit column mappings take precedence. Identifier cycles are resolved deterministically. Use `identifiers: false` to opt out. Unchanged columns in PostgreSQL views and materialized views retain their source identity when catalog provenance proves it. Partition columns reuse the parent identity, including across schemas. Transformed expressions and ambiguous UNION/coalesced join outputs retain conservative unbranded types. View nullability remains conservative.

## Type accuracy and constraints

The PostgreSQL adapter retains enums, nested domains, composite attributes, ranges/multiranges, array element identity, defaults, comments, primary keys, composite foreign keys, and raw checks. It reads one catalog snapshot with one SQL statement. An unresolved view source cannot hide an explicit catalog type mapping.

Defaults target `pg` 8 with its standard `pg-types` 2.x text parsers: int8/numeric select as strings, dates/timestamps as `Date | number` (infinity values), time as string, bytea as Buffer, JSON as `JsonValue`. JSON writes accept serialized JSON strings: node-postgres serializes top-level JavaScript arrays as PostgreSQL array literals, so accepting arbitrary JSON arrays would promise unsafe writes. Numeric arrays select numbers. Arrays whose OIDs have no registered parser, including user-defined enum arrays, select text. Composite and range values also default to text; map them when using custom parsers. Parsed arrays retain nullable elements and arbitrary nesting because PostgreSQL does not enforce declared array dimensions.

SQLite strict tables use enforced storage classes. Flexible tables retain possible storage classes instead of trusting declared affinity; `VARCHAR(20)` does not become a length restriction. Views retain conservative types and nullability. Integer rowid aliases, `WITHOUT ROWID`, nullable ordinary primary keys, generated columns, implicit composite foreign-key targets, and attached schemas are handled separately. `integers: 'bigint'` must match the application's driver settings.

Model interfaces carry `@schema`; properties carry `@required true`, database comments, and inferred constraints. PostgreSQL varchar/domain limits and simple whole-expression length checks become `@minLength`/`@maxLength`. Regex checks and function calls are retained as raw catalog checks, without translating their semantics. Supply explicit annotations through PostgreSQL comments:

```sql
COMMENT ON COLUMN public.account.name IS '@pattern ^[a-z]+$';

COMMENT ON COLUMN public.account.settings IS '@jsonSchema {"type":"object"}';
```

Nested domains resolve recursively to their underlying selected and write types, preserving nullability, defaults and length constraints. SQL aliases resolve to canonical PostgreSQL catalog types. Custom mappings can override any qualified domain, including one over `text`:

```ts
types: {
  'public.monetary': { select: "import('./money.js').Monetary" },
}
```

Relative imports resolve from the generated file. The application configures the matching driver parser; the generator never executes the imported module.

## Feed models into oapi

The existing oapi compiler skips `.d.ts` discovery. Keep generated declarations and mark a source alias, as in [`examples/sqlite/models.ts`](examples/sqlite/models.ts):

```ts
import type { Account as GeneratedAccount } from 'odb/main';

/** @schema */
export interface Account extends Omit<GeneratedAccount, 'id'> {
  id: number;
}
```

The example projects a named interface from the generated model and removes the ID brand for OpenAPI. The current sibling compiler cannot name branded types inside slash-named ambient modules directly. The projection retains the other generated property annotations. With the built sibling `../oapi` available, `npm run test:oapi` verifies that generated required keys, length limits, and patterns survive OpenAPI generation.

## Run from npm

Put the generation code in `scripts/generate.mjs` and add `"generate": "node scripts/generate.mjs"` to the consuming application's npm scripts. This repository's `npm run generate` builds the packages and runs the SQLite example. There is no Vite plugin.

Every generator exposes `files: { declarations: '...' }` and returns `{ files: { [path]: contents } }`; generators do no I/O. `generate()` finishes all generators before returning output. Duplicate, missing, and undeclared outputs fail. `writeFiles()` stages changed artifacts, protects declared inputs, and preserves unchanged mtimes. Failed scanning or generation leaves previous output intact.

## Verification

[`tests/golden.test.ts`](tests/golden.test.ts) discovers every numbered fixture folder. Each contains SQL and complete expected models/Kysely declarations, or an expected error. Every generated model is checked against real Kysely `Selectable` types. Additional usage and runtime cases cover brands, cross-schema foreign keys, JSONB, huge numbers, nested domains, custom local modules, normal/materialized PostgreSQL views and SQLite views.

By default, live PostgreSQL cases use node-postgres and Kysely over a PGlite socket. Set `ODB_TEST_DATABASE_URL` to run the same fixtures against a PostgreSQL server instead; its account needs `CREATEDB` and extension permissions. Each fixture creates and drops its own randomly named database. CI runs this suite against PostgreSQL 14–18. A SQLite runtime case executes real Kysely inserts, updates, deletes, defaults, and CamelCasePlugin names against node:sqlite. Standard `numeric[]` parsing loses precision; a separate custom-parser case proves exact decimal strings. The pinned Kanel and kysely-codegen references are regenerated against the same database and compared as complete files. The [hand-reviewed Kanel comparison](tests/050_pg_kanel_reference/comparison.md) regenerates actual Kanel output against the same database and compares complete files.

Package sources use `~/` imports. Builds resolve emitted `.js` extensions. Prettier enforces TypeScript and embedded catalog SQL formatting; ESLint and strict TypeScript checks run in `npm run check`.

The design was informed by [Kanel's type resolution](https://github.com/kristiandupont/kanel/blob/main/packages/kanel/src/generators/resolveType.ts), the supplied Kanel 3.16 configuration/patch, [kysely-codegen's PostgreSQL adapter](https://github.com/RobinBlomberg/kysely-codegen/blob/master/src/generator/dialects/postgres/postgres-adapter.ts), [node-postgres type parsing](https://node-postgres.com/features/types), and [SQLite's storage-class rules](https://www.sqlite.org/datatype3.html).

## npm releases

Branch pushes and pull requests run `npm run check`. Pushing a `vX.Y.Z` tag
sets all publishable workspace versions and internal dependencies from the tag,
runs the checks, and publishes validated tarballs to npm. Prerelease tags such
as `v1.0.0-beta.1` use npm's `next` dist-tag; stable versions use `latest`.
Configure the repository Actions secret `NPM_TOKEN` with npm publishing access
to `@opentyped`. Credentials are supplied only to the publish step.

```sh
git tag v0.1.0
git push origin HEAD
git push origin v0.1.0
```

Use a new version for every release; npm versions cannot be overwritten.

With `camelCase: true`, names must round-trip through the default Kysely `CamelCasePlugin`. Names such as `"userID"` or `a__b` fail generation because the plugin would query a different SQL identifier. Custom plugin naming options are not assumed.

`include` and `exclude` match qualified relation, SQL type, and routine names. Extension-owned types are retained as dependency metadata but are not independently exported. If a selected column actually uses an extension type without a standard parser mapping, supply its mapping; one run reports every missing mapping. Routines returning a composite or table row type expand to its attributes, like `RETURNS TABLE`. Callable routine declarations exclude trigger and handler functions; SQL `void` is represented by `void | null` and does not describe node-postgres's protocol placeholder as an application value.

Custom mapping selectors use dot-separated SQL names. If quoted identifiers make a supplied selector ambiguous (for example schema `"a.b"` / type `c` versus schema `a` / type `"b.c"`), generation rejects it rather than assigning the same mapping to unrelated types.
