import type { Kysely } from 'kysely';
import type { Database } from 'odb/kysely';
import type { AccountId, EntryId } from 'odb/kysely/public';
declare const db: Kysely<Database>;
declare const accountId: AccountId;
declare const entryId: EntryId;
const insert = db.insertInto('entry').values({ account_id: accountId }).returningAll();
const join = db
  .selectFrom('entry')
  .innerJoin('account', 'account.id', 'entry.account_id')
  .selectAll('entry');
// @ts-expect-error UUID and integer identifiers are different
const wrong = db.insertInto('entry').values({ account_id: entryId });
// @ts-expect-error bare strings are not validated account identifiers
const raw = db.insertInto('entry').values({ account_id: 'not-an-account' });
// @ts-expect-error generated identity cannot be provided
const generated = db.insertInto('entry').values({ id: entryId, account_id: accountId });
