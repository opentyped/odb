import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { generate } from '@opentyped/odb-db';
import { sqlite } from '@opentyped/odb-adapters-sqlite';
import { models } from '@opentyped/odb-models';
import { kysely } from '@opentyped/odb-kysely';
import { writeFiles, verifyFiles } from '@opentyped/odb-db/write';

const database = new DatabaseSync(':memory:');
try {
  database.exec(`CREATE TABLE account (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) >= 2) CHECK(length(name) <= 40),
    nickname TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    normalized TEXT GENERATED ALWAYS AS (upper(name)) STORED
  ) STRICT;`);
  const result = await generate({
    source: sqlite({ database }),
    columns: {
      'main.account.nickname': { select: 'string', annotations: { pattern: '^[A-Za-z ]+$' } },
    },
    generators: [
      models({ files: { declarations: 'generated/models.d.ts' } }),
      kysely({ files: { declarations: 'generated/kysely.d.ts' } }),
    ],
  });
  const root = fileURLToPath(new URL('.', import.meta.url));
  if (process.argv.includes('--verify')) await verifyFiles(result, root);
  else await writeFiles(result, root);
  console.log('Generated examples/sqlite/generated/{models,kysely}.d.ts');
} finally {
  database.close();
}
