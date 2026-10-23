import assert from 'node:assert/strict';
import pg from 'pg';
import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely';
import type { Database } from 'odb/kysely';
import type { UserProfile, NewUserProfile, UserProfileId } from 'odb/kysely/public';
export async function verify(connectionString: string): Promise<void> {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
    plugins: [new CamelCasePlugin()],
  });
  try {
    const input: NewUserProfile = { userId: 1 as UserProfileId, displayName: 'Ada' };
    const row: UserProfile = await db
      .insertInto('userProfile')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.deepEqual(row, { userId: 1, displayName: 'Ada', createdCount: 0 });
    await db.updateTable('userProfile').set({ displayName: 'Grace' }).execute();
    const selected = await db.selectFrom('userProfile').selectAll().executeTakeFirstOrThrow();
    assert.equal(selected.displayName, 'Grace');
    if (false) {
      // @ts-expect-error runtime plugin requires camel case keys
      db.selectFrom('user_profile');
      // @ts-expect-error generated inputs match transformed field names
      const wrong: NewUserProfile = { user_id: 1, display_name: 'bad' };
    }
  } finally {
    await db.destroy();
  }
}
