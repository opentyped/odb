import type { Kysely } from 'kysely';
import type { Database } from 'odb/kysely';
import type Money from '~/money';
declare const db: Kysely<Database>;
declare const value: Money;
const selected: Promise<Money> = db
  .selectFrom('purse')
  .select('balance')
  .executeTakeFirstOrThrow()
  .then((row) => row.balance);
// @ts-expect-error a plain string is not the branded Decimal from the local module
const insert = db.insertInto('purse').values({ balance: { value: '1' }, amount: '1' });
