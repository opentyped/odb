import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { processDatabase, type Config as KanelConfig } from 'kanel';
import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { hstore } from '@electric-sql/pglite/contrib/hstore';
import { citext } from '@electric-sql/pglite/contrib/citext';
import ts from 'typescript';
import {
  generate,
  resolve,
  type Database,
  type ResolveOptions,
  type ResolvedDatabase,
  type Source,
} from '@opentyped/odb-db';
import { postgres } from '@opentyped/odb-adapters-pg';
import { sqlite, type SqliteClient } from '@opentyped/odb-adapters-sqlite';
import { models } from '@opentyped/odb-models';
import { kysely } from '@opentyped/odb-kysely';
import { writeFiles } from '@opentyped/odb-db/write';

interface Options extends ResolveOptions {
  dialect: 'pg' | 'sqlite';
  schemas?: string[];
  integers?: 'number' | 'bigint';
  prefix?: string;
  repeat?: boolean;
  bigintMetadata?: boolean;
  steps?: boolean;
  fileSource?: boolean;
  extensions?: Array<'ltree' | 'hstore' | 'citext'>;
}

const directory = fileURLToPath(new URL('.', import.meta.url));
const cases = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
assert.ok(cases.length, 'Numbered SQL golden fixtures must exist.');
let previousProgram: ts.Program | undefined;

function typecheck(root: string, files: string[], expectedDiagnostics?: unknown): void {
  const program = ts.createProgram({
    rootNames: files
      .filter((file) => expectedDiagnostics === undefined || file !== 'contract.ts')
      .map((file) => path.join(root, file)),
    options: {
      noEmit: true,
      allowImportingTsExtensions: true,
      strict: true,
      exactOptionalPropertyTypes: true,
      skipLibCheck: false,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      types: ['node'],
      baseUrl: root,
      paths: { '~/*': ['./*.ts'] },
    },
    ...(previousProgram ? { oldProgram: previousProgram } : {}),
  });
  previousProgram = program;
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (expectedDiagnostics !== undefined) {
    assert.deepEqual(
      diagnostics
        .map((diagnostic) => ({
          file: path.basename(diagnostic.file!.fileName),
          code: diagnostic.code,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }))
        .sort((a, b) => a.file.localeCompare(b.file)),
      expectedDiagnostics,
    );
    return;
  }
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (file) => file,
      getNewLine: () => '\n',
    }),
  );
}

/** OIDs are intentionally absent from authored catalog assertions. */
function metadata(database: ResolvedDatabase): unknown {
  const names = new Map(database.types.map((type) => [type.id, `${type.schema}.${type.name}`]));
  const columns = (input: Database['relations'][number]['columns']): unknown =>
    Object.fromEntries(
      input.map((column) => [column.name, { ...column, type: names.get(column.type) }]),
    );
  return {
    relations: Object.fromEntries(
      database.relations.map((relation) => [
        `${relation.schema}.${relation.name}`,
        { ...relation, columns: columns(relation.columns) },
      ]),
    ),
    types: Object.fromEntries(
      database.types.map(({ id, ...type }) => [
        names.get(id),
        {
          ...type,
          ...('base' in type ? { base: names.get(type.base) } : {}),
          ...('element' in type ? { element: names.get(type.element) } : {}),
          ...('columns' in type ? { columns: columns(type.columns) } : {}),
        },
      ]),
    ),
    identifiers: database.identifiers,
    warnings: database.warnings,
  };
}

function assertMetadata(actual: unknown, expected: unknown, location: string): void {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    assert.ok(actual !== null && typeof actual === 'object', location);
    for (const [key, value] of Object.entries(expected))
      assertMetadata((actual as Record<string, unknown>)[key], value, `${location}.${key}`);
  } else assert.deepEqual(actual, expected, location);
}

for (const name of cases)
  test(`golden ${name}`, async (t) => {
    const fixture = path.join(directory, name);
    const entries = await readdir(fixture);
    for (const file of ['schema.sql', 'options.json'])
      assert.ok(entries.includes(file), `${name} requires ${file}`);
    const options = JSON.parse(
      await readFile(path.join(fixture, 'options.json'), 'utf8'),
    ) as Options;
    const error = entries.includes('error.txt')
      ? (await readFile(path.join(fixture, 'error.txt'), 'utf8')).trimEnd()
      : undefined;
    if (error === undefined)
      for (const file of ['models.d.ts', 'kysely.d.ts'])
        assert.ok(entries.includes(file), `${name} requires ${file}`);
    const root = await mkdtemp(path.join(directory, '.golden-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await cp(fixture, root, { recursive: true });
    // Remove copied expectations: only freshly generated output may satisfy the compiler.
    for (const file of ['models.d.ts', 'kysely.d.ts'])
      await rm(path.join(root, file), { force: true });
    const sql = await readFile(path.join(root, 'schema.sql'), 'utf8');
    let source: Source;
    let connectionString: string | undefined;
    let execute: (sql: string) => Promise<void>;
    if (options.dialect === 'pg') {
      const extensions = Object.fromEntries(
        (options.extensions ?? []).map((name) => [name, { ltree, hstore, citext }[name]]),
      );
      const client = new PGlite({ extensions });
      let closeSocket: (() => Promise<void>) | undefined;
      t.after(async () => {
        await closeSocket?.();
        await client.close();
      });
      await client.exec(sql);
      execute = async (sql) => {
        await client.exec(sql);
      };
      let queryClient: typeof client | pg.Pool = client;
      if (entries.includes('runtime.ts') || entries.includes('kanel.json')) {
        const socket = new PGLiteSocketServer({
          db: client,
          port: 0,
          host: '127.0.0.1',
          maxConnections: 20,
        });
        await socket.start();
        connectionString = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`;
        const pool = new pg.Pool({ connectionString, max: 1 });
        closeSocket = async () => {
          await pool.end();
          await socket.stop();
        };
        queryClient = pool;
      }
      source = postgres({
        client: queryClient,
        ...(options.schemas ? { schemas: options.schemas } : {}),
      });
    } else {
      const filename = path.join(root, 'database.sqlite');
      const client = new DatabaseSync(options.fileSource ? filename : ':memory:');
      t.after(() => client.close());
      client.exec(sql);
      execute = async (sql) => {
        client.exec(sql);
      };
      if (entries.includes('queries.json')) {
        const queries = JSON.parse(
          await readFile(path.join(fixture, 'queries.json'), 'utf8'),
        ) as Array<{ sql: string; rows: unknown[] }>;
        for (const query of queries)
          assert.deepEqual(JSON.parse(JSON.stringify(client.prepare(query.sql).all())), query.rows);
      }
      const wrapped: SqliteClient = options.bigintMetadata
        ? {
            prepare(sql) {
              const statement = client.prepare(sql);
              return {
                all(...params) {
                  return statement
                    .all(...params)
                    .map((row) =>
                      Object.fromEntries(
                        Object.entries(row).map(([key, value]) => [
                          key,
                          typeof value === 'number' ? BigInt(value) : value,
                        ]),
                      ),
                    );
                },
              };
            },
          }
        : client;
      source = sqlite({
        database: options.fileSource ? filename : wrapped,
        ...(options.schemas ? { schemas: options.schemas } : {}),
        ...(options.integers ? { integers: options.integers } : {}),
      });
    }
    let reads = 0;
    const config = {
      ...options,
      source: {
        watchFiles: [...(source.watchFiles ?? []), path.join(root, 'schema.sql')],
        async read() {
          reads++;
          return source.read();
        },
      },
      generators: [
        models({
          files: { declarations: 'models.d.ts' },
          ...(options.prefix !== undefined ? { prefix: options.prefix } : {}),
        }),
        kysely({
          files: { declarations: 'kysely.d.ts' },
          ...(options.prefix !== undefined ? { prefix: `${options.prefix}/kysely` } : {}),
        }),
      ],
    };
    if (error !== undefined) {
      await assert.rejects(generate(config), (failure: unknown) => {
        assert.ok(failure instanceof Error);
        assert.equal(failure.message, error);
        return true;
      });
      return;
    }
    const result = await generate(config);
    assert.equal(reads, 1, 'All generators must share one database scan');
    assert.deepEqual(Object.keys(result.files).sort(), ['kysely.d.ts', 'models.d.ts']);
    for (const [file, contents] of Object.entries(result.files))
      assert.equal(
        contents,
        await readFile(path.join(fixture, file), 'utf8'),
        `${name}/${file}: generated declarations differ from the authored contract`,
      );
    if (entries.includes('metadata.json'))
      assertMetadata(
        metadata(result.database),
        JSON.parse(await readFile(path.join(fixture, 'metadata.json'), 'utf8')),
        name,
      );
    await writeFiles(result, root);
    if (entries.includes('kanel.json')) {
      assert.ok(connectionString);
      const kanelOptions = JSON.parse(
        await readFile(path.join(fixture, 'kanel.json'), 'utf8'),
      ) as Omit<KanelConfig, 'connection'>;
      const outputPath = path.join(root, 'kanel');
      await rm(outputPath, { recursive: true, force: true });
      await processDatabase({
        ...kanelOptions,
        connection: connectionString,
        outputPath,
        typeFilter: (type) => type.kind !== 'function' && type.kind !== 'procedure',
      });
      const expectedFiles = await readdir(path.join(fixture, 'kanel'), {
        recursive: true,
        withFileTypes: true,
      });
      const actualFiles = await readdir(outputPath, { recursive: true, withFileTypes: true });
      const paths = (files: typeof actualFiles, base: string): string[] =>
        files
          .filter((file) => file.isFile())
          .map((file) => path.relative(base, path.join(file.parentPath, file.name)))
          .sort();
      assert.deepEqual(
        paths(actualFiles, outputPath),
        paths(expectedFiles, path.join(fixture, 'kanel')),
      );
      for (const file of paths(actualFiles, outputPath))
        assert.equal(
          await readFile(path.join(outputPath, file), 'utf8'),
          await readFile(path.join(fixture, 'kanel', file), 'utf8'),
          `${name}/kanel/${file}`,
        );
    }
    const modelModule = options.prefix ?? 'odb';
    const tableModule = `${modelModule}/kysely`;
    const aliases = result.database.relations
      .flatMap((relation, index) => {
        const namespace = encodeURIComponent(relation.schema);
        const model = `import(${JSON.stringify(`${modelModule}/${namespace}`)}).${relation.typeName}`;
        const table = `import(${JSON.stringify(`${tableModule}/${namespace}`)}).${relation.typeName}Table`;
        const output = `import(${JSON.stringify(`${tableModule}/${namespace}`)})`;
        return [
          `export type ModelAlias${index} = Assert<Equal<${model}, ${output}.${relation.typeName}>>;`,
          `export type InsertAlias${index} = Assert<Equal<Insertable<${table}>, ${output}.New${relation.typeName}>>;`,
          `export type UpdateAlias${index} = Assert<Equal<Updateable<${table}>, ${output}.${relation.typeName}Update>>;`,
        ];
      })
      .join('\n');
    await writeFile(
      path.join(root, 'contract.ts'),
      `
import type { Selectable, Insertable, Updateable } from 'kysely';
import type { Database as Tables } from ${JSON.stringify(tableModule)};
import type { Database as Models } from ${JSON.stringify(modelModule)};
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
${aliases}
export type SameKeys = Assert<Equal<keyof Tables,keyof Models>>;
export type SelectedModels = Assert<false extends { [K in keyof Tables]: Equal<Models[K & keyof Models],Selectable<Tables[K]>> }[keyof Tables] ? false : true>;
`,
    );
    typecheck(
      root,
      [
        'models.d.ts',
        'kysely.d.ts',
        'contract.ts',
        ...(entries.includes('usage.ts') ? ['usage.ts'] : []),
        ...(entries.includes('runtime.ts') ? ['runtime.ts'] : []),
      ],
      entries.includes('diagnostics.json')
        ? JSON.parse(await readFile(path.join(fixture, 'diagnostics.json'), 'utf8'))
        : undefined,
    );
    if (entries.includes('runtime.ts')) {
      assert.ok(connectionString);
      const runtime = (await import(pathToFileURL(path.join(root, 'runtime.ts')).href)) as {
        verify: (connection: string) => Promise<void>;
      };
      await runtime.verify(connectionString);
    }
    if (options.steps) {
      const before = await readFile(path.join(root, 'models.d.ts'), 'utf8');
      await assert.rejects(async () => {
        const failed = await generate({
          ...config,
          generators: [
            {
              name: 'failure',
              files: { declarations: 'failure.d.ts' },
              generate() {
                throw new Error('Expected generator failure');
              },
            },
          ],
        });
        await writeFiles(failed, root);
      }, /Expected generator failure/);
      assert.equal(await readFile(path.join(root, 'models.d.ts'), 'utf8'), before);
      for (const step of (await readdir(path.join(fixture, 'steps'))).sort()) {
        const stepRoot = path.join(fixture, 'steps', step);
        await execute(await readFile(path.join(stepRoot, 'schema.sql'), 'utf8'));
        await writeFiles(await generate(config), root);
        for (const file of ['models.d.ts', 'kysely.d.ts']) {
          assert.equal(
            await readFile(path.join(root, file), 'utf8'),
            await readFile(path.join(stepRoot, file), 'utf8'),
            `${name}/${step}/${file}`,
          );
        }
      }
    }
    if (options.repeat) {
      const before = (await stat(path.join(root, 'models.d.ts'))).mtimeMs;
      assert.deepEqual(await generate(config), result);
      assert.deepEqual(await writeFiles(result, root), []);
      assert.equal((await stat(path.join(root, 'models.d.ts'))).mtimeMs, before);
    }
  });

test('Source and generator boundary errors do not produce partial files', async (t) => {
  const root = await mkdtemp(path.join(directory, '.golden-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const database: Database = { dialect: 'pg', types: [], relations: [], warnings: [] };
  const source: Source = { read: async () => database };
  const first = models({ files: { declarations: 'models.d.ts' } });
  await assert.rejects(
    generate({ source, generators: [first, first] }),
    /Multiple generators emit/,
  );
  await assert.rejects(
    generate({
      source,
      generators: [
        {
          name: 'missing',
          files: { declarations: 'models.d.ts' },
          generate: () => ({ files: {} }),
        },
      ],
    }),
    /did not emit declared/,
  );
  await assert.rejects(
    generate({
      source,
      generators: [
        {
          name: 'undeclared',
          files: { declarations: 'models.d.ts' },
          generate: () => ({ files: { 'other.d.ts': '' } }),
        },
      ],
    }),
    /undeclared file/,
  );
  await assert.rejects(
    writeFiles({ files: { 'types.d.ts': 'a', './types.d.ts': 'b' } }, root),
    /Duplicate output destination/,
  );
  await assert.rejects(
    writeFiles({ files: { 'schema.sql': '' } }, root, ['schema.sql']),
    /overwrite generation input/,
  );
  assert.throws(
    () =>
      models({ files: { declarations: 'models.d.ts' }, prefix: './invalid' }).generate(
        resolve(database),
      ),
    /ambient module prefix/,
  );
  await assert.rejects(sqlite({ database: path.join(root, 'missing.sqlite') }).read());
  const cycle: Database = {
    dialect: 'pg',
    warnings: [],
    types: [
      {
        id: 'cycle',
        schema: 'public',
        name: 'cycle',
        comment: null,
        annotations: {},
        kind: 'domain',
        base: 'cycle',
        nullable: true,
        default: null,
        checks: [],
      },
    ],
    relations: [
      {
        schema: 'public',
        name: 'test',
        kind: 'table',
        checks: [],
        comment: null,
        columns: [
          {
            name: 'value',
            type: 'cycle',
            nullable: true,
            default: null,
            identity: null,
            generated: false,
            primaryKey: false,
            references: [],
            comment: null,
            annotations: {},
          },
        ],
      },
    ],
  };
  assert.throws(() => resolve(cycle), /Cyclic database type/);
  assert.throws(
    () => resolve({ ...cycle, types: [...cycle.types, ...cycle.types] }),
    /Duplicate database type ID/,
  );
});
