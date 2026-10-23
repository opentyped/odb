# Project goals

- Build a lightweight, database-first TypeScript generator inspired by `../oapi`.
- Scan existing PostgreSQL and SQLite databases into one shared, driver-independent model.
- Match Kanel's relevant PostgreSQL capabilities and robustness; compare against kysely-codegen.
- Keep separate workspaces for `db`, PostgreSQL/SQLite adapters, `models`, and `kysely`.
- Prefix package names with `@opentyped/odb-`; keep directory names unchanged.
- Generate one ambient `.d.ts` file per generator, with schema-specific imports such as `odb/public` and `odb/kysely/main`.
- Export one combined Kysely `Database`, plus table, selected, insert, and update types.
- Make pure models exactly equal to Kysely's selected types, verified by compilation.
- Preserve branded primary-key and foreign-key identity across tables, schemas, and views.
- Support shared custom mappings to third-party and local types, including Decimal; keep runtime parsers consistent.
- Handle obscure PostgreSQL types, nested domains, enums, arrays, composites, ranges, huge numbers, and JSON accurately.
- Cover PostgreSQL views/materialized views and SQLite views, attachments, and storage semantics conservatively.
- Export named SQL types and routine definitions; support relation filtering, partitions, and CamelCasePlugin naming.
- Extract only reliable constraints; preserve database comments and annotations for oapi generation.
- Use oapi-style `files` contracts, npm-script generation, and stale-output verification; no Vite plugin.
- Maintain extensive SQL/expected-output fixtures, real Kysely/runtime tests, and reference comparisons.
- Enforce readable code and SQL with Prettier, ESLint, strict TypeScript, and correct emitted imports.
