import assert from 'node:assert/strict';
import pg from 'pg';
import type { GetOneParameters, GetOneResult, GetOneRow } from 'odb/public';
export async function verify(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  try {
    const parameters: GetOneParameters = {};
    const scalar = await pool.query<{ value: GetOneResult }>('SELECT get_one() AS value');
    assert.equal(scalar.rows[0]?.value, 42);
    const row = await pool.query<GetOneRow>('SELECT * FROM get_one()');
    assert.deepEqual(row.rows[0], { value: 42 });
    if (false) {
      // @ts-expect-error scalar invocation is a value, not its FROM row
      const wrong: GetOneResult = { value: 42 };
      // @ts-expect-error no-argument routines reject invented inputs
      const args: GetOneParameters = { unknown: 1 };
    }
  } finally {
    await pool.end();
  }
}
