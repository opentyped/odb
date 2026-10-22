import type { Kysely, Insertable } from 'kysely';
import type { Database } from 'odb/kysely';
import type { InvoiceTable } from 'odb/kysely/public';
import type { Invoice } from 'odb/public';
declare const db: Kysely<Database>;
const insert: Insertable<InvoiceTable> = {
  balance: { amount: 9007199254740993n, currency: 'USD' },
};
const query = db.insertInto('invoice').values(insert).returningAll();
const selected: Promise<Invoice[]> = db.selectFrom('invoice').selectAll().execute();
// @ts-expect-error custom module currency union is retained
const invalid: Insertable<InvoiceTable> = { balance: { amount: '1', currency: 'GBP' } };
