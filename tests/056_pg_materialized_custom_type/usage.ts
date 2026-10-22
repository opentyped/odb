import type { Kysely } from 'kysely';
import type { Database } from 'odb/kysely';
declare const db: Kysely<Database>;
const read = db.selectFrom('account_snapshot').select('balance').execute();
// @ts-expect-error materialized views are read-only
const write = db.updateTable('account_snapshot').set({ balance: { amount: '1', currency: 'USD' } });
