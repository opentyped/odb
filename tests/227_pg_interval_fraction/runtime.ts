import assert from 'node:assert/strict';
import pg from 'pg';
import type { Intervals } from 'odb/public';
export async function verify(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query<Intervals>("SELECT interval '1.123456 seconds' AS value");
    assert.equal(result.rows[0]?.value.seconds, 1);
    assert.equal(result.rows[0]?.value.milliseconds, 123.456);
  } finally {
    await pool.end();
  }
}
