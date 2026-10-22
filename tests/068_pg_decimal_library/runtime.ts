import assert from 'node:assert/strict';
import pg from 'pg';
import { Decimal } from 'decimal.js';
import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Database } from 'odb/kysely';
import type { Ledger as Model } from 'odb/public';
import type { Ledger, NewLedger, LedgerUpdate } from 'odb/kysely/public';
export async function verify(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  const original = pg.types.getTypeParser(1700);
  pg.types.setTypeParser(1700, (value) => new Decimal(value));
  try {
    const exact = '123456789012345678901234567890.123456789012345678901234567890';
    const input = new Decimal(exact);
    Object.defineProperty(input, 'toPostgres', { value: () => input.toFixed() });
    const values: NewLedger = { amount: input };
    const row: Ledger = await db
      .insertInto('ledger')
      .values(values)
      .returningAll()
      .executeTakeFirstOrThrow();
    const model: Model = row;
    assert.ok(model.amount instanceof Decimal);
    assert.equal(model.amount.toFixed(30), exact);
    const patch: LedgerUpdate = { amount: exact };
    await db.updateTable('ledger').set(patch).execute();
    const view = await db.selectFrom('ledger_view').selectAll().executeTakeFirstOrThrow();
    assert.ok(view.amount instanceof Decimal);
    await sql`REFRESH MATERIALIZED VIEW ledger_snapshot`.execute(db);
    const snapshot = await db.selectFrom('ledger_snapshot').selectAll().executeTakeFirstOrThrow();
    assert.ok(snapshot.amount instanceof Decimal);
    assert.equal(snapshot.amount.toFixed(30), exact);
    if (false) {
      // @ts-expect-error generated models expose Decimal, not the underlying SQL string
      const wrong: Model = { amount: exact };
      // @ts-expect-error numbers are not accepted unless explicitly configured as inputs
      const wrongInput: NewLedger = { amount: 1 };
    }
  } finally {
    pg.types.setTypeParser(1700, original);
    await db.destroy();
  }
}
