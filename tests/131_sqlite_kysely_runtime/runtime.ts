import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { Kysely, SqliteDialect, CamelCasePlugin } from 'kysely';
import type { Database } from 'odb/kysely';
import type { UserProfile, NewUserProfile } from 'odb/kysely/main';
import type { UserProfile as Model } from 'odb/main';
export async function verify(filename: string): Promise<void> {
  const connection = new DatabaseSync(filename);
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({
      database: {
        close: () => connection.close(),
        prepare(sql) {
          const statement = connection.prepare(sql);
          return {
            reader: statement.columns().length > 0,
            all: (parameters) => statement.all(...(parameters as SQLInputValue[])),
            run: (parameters) => statement.run(...(parameters as SQLInputValue[])),
            iterate: (parameters) => statement.iterate(...(parameters as SQLInputValue[])),
          };
        },
      },
    }),
    plugins: [new CamelCasePlugin()],
  });
  try {
    const input: NewUserProfile = { displayName: 'Ada' };
    const row: UserProfile = await db
      .insertInto('userProfile')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
    const model: Model = row;
    assert.deepEqual(model, { userId: 1, displayName: 'Ada', createdCount: 0 });
    await db
      .updateTable('userProfile')
      .set({ displayName: 'Grace' })
      .where('userId', '=', row.userId)
      .execute();
    assert.equal(
      (await db.selectFrom('userProfile').selectAll().executeTakeFirstOrThrow()).displayName,
      'Grace',
    );
    await db.deleteFrom('userProfile').where('userId', '=', row.userId).execute();
    assert.deepEqual(await db.selectFrom('userProfile').selectAll().execute(), []);
  } finally {
    await db.destroy();
  }
}
