import assert from 'node:assert/strict';
import pg from 'pg';
import type { EchoParameters, EchoResult } from 'odb/public';
export async function verify(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  try {
    const input: EchoParameters = { arg1: 42 };
    const numeric = await pool.query<{ value: EchoResult }>('SELECT echo($1::integer) AS value', [
      input.arg1,
    ]);
    const boolean = await pool.query<{ value: EchoResult }>('SELECT echo(true) AS value');
    assert.equal(numeric.rows[0]?.value, 42);
    assert.equal(boolean.rows[0]?.value, true);
    if (false) {
      // @ts-expect-error unknown polymorphic results require narrowing
      const guessed: string = numeric.rows[0]!.value;
    }
  } finally {
    await pool.end();
  }
}
