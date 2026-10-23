# Kanel 3.16 comparison

Both generators run against this folder's `schema.sql` on the same PostgreSQL engine. `kanel/` contains the unmodified output of Kanel 3.16.0, with the checked-in `kanel.json` configuration. The runner regenerates it and compares every byte and filename. The adjacent `models.d.ts` and `kysely.d.ts` are independently authored odb expectations. `usage.ts` checks the shared contracts and intentional differences with TypeScript.

| Contract inspected by hand   | Kanel output                   | odb output                           | Assessment                                                                                                                                                                                       |
| ---------------------------- | ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public.account` field names | `kanel/public/Account.ts`      | `models.d.ts`, `odb/public.Account`  | Same fields.                                                                                                                                                                                     |
| `role`                       | Named union `Role`             | Inline union                         | Identical selected values, checked in `usage.ts`.                                                                                                                                                |
| `balance` domain             | `Price = string`, non-null     | `string`, non-null                   | Same selected value; odb also retains numeric write types.                                                                                                                                       |
| `billing.invoice.account_id` | Reuses `public.AccountId`      | References `odb/public.AccountId`    | Both preserve foreign-key identity across schemas.                                                                                                                                               |
| Schema separation            | Per-schema files               | Separate ambient modules in one file | Keeps names distinct without import ambiguity.                                                                                                                                                   |
| ID brand payload             | `public.account`               | `public.account.id`                  | Intentional: distinguish independent columns of composite keys.                                                                                                                                  |
| JSONB                        | `unknown`                      | Recursive `JsonValue`                | odb describes actual parsed JSON, including JSON null. Writes use serialized JSON.                                                                                                               |
| `time`                       | `Date`                         | `string`                             | Intentional correction for standard node-postgres parsers; live Kysely tests verify it.                                                                                                          |
| Timestamp infinity           | `Date`                         | `Date \| number`                     | Includes PostgreSQL infinity, verified through node-postgres.                                                                                                                                    |
| `text[]`                     | `string[]`                     | `PgArray<string>`                    | Retains nullable elements and unconstrained dimensions.                                                                                                                                          |
| View `id`                    | Source-branded, non-null       | `AccountId \| null`                  | Source identity is traced through the analyzed catalog tree; view nullability stays conservative through joins. Separate fixtures cover outer joins, custom types, casts and materialized views. |
| Writes                       | Initializer/mutator interfaces | Kysely `ColumnType`                  | Defaults and generated columns are checked through real Kysely queries.                                                                                                                          |

The driver-specific differences are intentional; Kanel's default mappings are not treated as evidence that a driver returns those JavaScript values. Local module mappings can retain existing application types or legacy brands.

The same runner also generates the complete `codegen.d.ts` with pinned kysely-codegen 0.20.0. Both references introspect the same live fixture database; neither output is produced by odb.

| Checked contract                             | kysely-codegen                     | odb                                                               |
| -------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Database/table keys and selected field names | Same                               | Type equality checked in `usage.ts`.                              |
| Enum labels                                  | Named `Role`, reordered union      | Named `Role`, SQL enum order; equivalent union.                   |
| `time`                                       | String                             | String, verified with real pg queries.                            |
| Numeric domain `NOT NULL`                    | `Numeric \| null`                  | Non-null string, retaining the domain constraint.                 |
| View identity                                | Unbranded `Int8 \| null`           | Source `AccountId \| null`; conservative nullability.             |
| JSON writes                                  | Accepts its JSON value type        | Serialized strings avoid pg's top-level array serialization trap. |
| Parsed arrays                                | One-dimensional, non-null elements | Arbitrary dimensions and nullable elements.                       |
| Timestamp infinity                           | Date-only selected type            | `Date \| number`, tested against pg's parser.                     |

These differences are explicit driver/correctness decisions, not incomplete copies of the reference output.
