import assert from 'node:assert/strict';
import pg from 'pg';
import type { TypeId } from 'pg-types';
import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Database } from 'odb/kysely';
import type { Wallet, WalletView, WalletSnapshot } from 'odb/public';
import { Monetary } from './money.ts';

export async function verify(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  const {
    rows: [type],
  } = await pool.query<{ oid: TypeId }>("SELECT 'public.monetary'::regtype::oid AS oid");
  assert.ok(type);
  const original = pg.types.getTypeParser(type.oid);
  pg.types.setTypeParser(type.oid, Monetary.fromPostgres);
  try {
    const exact = '123456789012345678901234567890.12345678901234567890123456789';
    const inserted: Wallet = await db
      .insertInto('wallet')
      .values({ balance: new Monetary(exact, 'USD') })
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.ok(inserted.balance instanceof Monetary);
    assert.equal(inserted.balance.amount, exact);
    const view: WalletView = await db
      .selectFrom('wallet_view')
      .selectAll()
      .executeTakeFirstOrThrow();
    assert.ok(view.balance instanceof Monetary);
    assert.equal(view.balance.amount, exact);
    await sql`REFRESH MATERIALIZED VIEW wallet_snapshot`.execute(db);
    const snapshot: WalletSnapshot = await db
      .selectFrom('wallet_snapshot')
      .selectAll()
      .executeTakeFirstOrThrow();
    assert.ok(snapshot.balance instanceof Monetary);
    assert.equal(snapshot.balance.currency, 'USD');
    if (false) {
      // @ts-expect-error application-owned classes keep their methods and nominal shape
      db.insertInto('wallet').values({ balance: { amount: exact, currency: 'USD' } });
      // @ts-expect-error pure models retain decimal precision as a string
      const number: number = inserted.balance.amount;
    }
  } finally {
    pg.types.setTypeParser(type.oid, original);
    await db.destroy();
  }
}
