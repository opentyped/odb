import assert from 'node:assert/strict';
import pg from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Database } from 'odb/kysely';
import type { Sample } from 'odb/public';

export async function verify(connectionString: string): Promise<void> {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 1 }) }),
  });
  try {
    const row: Sample = await db
      .insertInto('sample')
      .values({
        amounts: ['1.234567890123456789', null],
        huge_ids: ['9223372036854775807', null],
        flags: [true, null, false],
        points: '(1.5,2.5)',
        circle: '<(1,2),3>',
        duration: '2 days 01:02:03',
        when_value: '2024-01-01',
        jsons: [JSON.stringify({ name: 'one' }), 'null'],
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.deepEqual(row.amounts, [1.2345678901234567, null]); // pg's standard numeric[] parser is lossy
    assert.deepEqual(row.huge_ids, ['9223372036854775807', null]);
    assert.deepEqual(row.flags, [true, null, false]);
    assert.deepEqual(row.points, { x: 1.5, y: 2.5 });
    assert.deepEqual(row.circle, { x: 1, y: 2, radius: 3 });
    assert.equal(row.duration.days, 2);
    assert.equal(row.duration.hours, 1);
    assert.ok(row.when_value instanceof Date);
    assert.deepEqual(row.jsons, [{ name: 'one' }, null]);
    await assert.rejects(
      sql`
        SELECT
          ${{ x: 1, y: 2 }}::point
      `.execute(db),
      /invalid input syntax/,
    );
    if (false) {
      // @ts-expect-error pg serializes a plain object as JSON, which is not point input syntax
      db.updateTable('sample').set({ points: { x: 1, y: 2 } });
    }
  } finally {
    await db.destroy();
  }
}
