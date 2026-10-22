import assert from 'node:assert/strict';
import pg from 'pg';
import type { TypeId } from 'pg-types';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from 'odb/kysely';
import type { PreciseAmounts } from 'odb/public';

export async function verify(connectionString: string): Promise<void> {
  const original = pg.types.getTypeParser(1231 as TypeId);
  // Use pg's text[] parser for numeric[]; the fixture maps this runtime choice to PgArray<string>.
  pg.types.setTypeParser(1231 as TypeId, pg.types.getTypeParser(1009 as TypeId));
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 1 }) }),
  });
  try {
    const exact = '123456789012345678901234567890.12345678901234567890123456789';
    const row: PreciseAmounts = await db
      .insertInto('precise_amounts')
      .values({ values: [exact, null] })
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.deepEqual(row.values, [exact, null]);
    if (false) {
      // @ts-expect-error mapped numeric array results are strings, not numbers
      const rounded: number = row.values[0]!;
    }
  } finally {
    await db.destroy();
    pg.types.setTypeParser(1231 as TypeId, original);
  }
}
