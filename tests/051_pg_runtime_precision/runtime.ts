import assert from 'node:assert/strict';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from 'odb/kysely';
import type { ParentId } from 'odb/kysely/public';
import type { ChildId as BillingChildId } from 'odb/kysely/billing';
import type { Parent } from 'odb/public';

export async function verify(connectionString: string): Promise<void> {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 1 }) }),
  });
  const payload = { nested: { tags: ['one', 'two'] }, enabled: true };
  const exact =
    '12345678901234567890123456789012345678901234567890.123456789012345678901234567890123456789';
  try {
    const values = {
      huge: 9223372036854775807n,
      exact,
      data: JSON.stringify([payload, null, 42]),
      typed_data: JSON.stringify(payload),
      moment: 'infinity',
      bytes: Buffer.from([0, 128, 255]),
    };
    const row: Parent = await db
      .insertInto('parent')
      .values(values)
      .returningAll()
      .executeTakeFirstOrThrow();
    const id: ParentId = row.id;
    const huge: string = row.huge;
    const precise: string = row.exact;
    assert.equal(huge, '9223372036854775807');
    assert.equal(precise, exact + '0'.repeat(400 - exact.split('.')[1]!.length));
    assert.deepEqual(row.data, [payload, null, 42]);
    assert.deepEqual(row.typed_data, payload);
    assert.equal(row.moment, Infinity);
    assert.deepEqual(row.bytes, Buffer.from([0, 128, 255]));
    const child = await db
      .insertInto('billing.child')
      .values({ parent_id: id })
      .returningAll()
      .executeTakeFirstOrThrow();
    const childId: BillingChildId = child.id;
    const joined = await db
      .selectFrom('billing.child as c')
      .innerJoin('parent as p', 'p.id', 'c.parent_id')
      .select(['c.id', 'p.huge'])
      .where('c.id', '=', childId)
      .executeTakeFirstOrThrow();
    assert.equal(joined.huge, huge);
    const updated = await db
      .updateTable('parent')
      .set({ huge: -9223372036854775808n, data: 'null' })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.equal(updated.huge, '-9223372036854775808');
    assert.equal(updated.data, null); // JSON null, despite SQL NOT NULL
    const parents: Parent[] = await db.selectFrom('parent').selectAll().execute();
    assert.equal(parents.length, 1);
    if (false) {
      // @ts-expect-error bigint results must not silently become lossy JS numbers
      const lossy: number = row.huge;
      // @ts-expect-error arbitrary-precision numeric results remain strings
      const rounded: number = row.exact;
      // @ts-expect-error child and parent identifiers are not interchangeable
      db.insertInto('billing.child').values({ parent_id: childId });
      // @ts-expect-error database-generated identities cannot be inserted
      db.insertInto('parent').values({ ...values, id });
      // @ts-expect-error default JSON writes are serialized to avoid pg array serialization
      db.updateTable('parent').set({ data: [payload] });
      // @ts-expect-error nested custom-module properties retain their string array type
      const tag: number = row.typed_data.nested.tags[0]!;
    }
  } finally {
    await db.destroy();
  }
}
