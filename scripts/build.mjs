import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
for (const pkg of ['db', 'adapters/pg', 'adapters/sqlite', 'models', 'kysely']) {
  rmSync(`packages/${pkg}/dist`, { recursive: true, force: true });
  for (const [tool, flags] of [
    ['typescript/bin/tsc', []],
    ['tsc-alias/dist/bin/index.js', ['--resolve-full-paths', '--resolve-full-extension', '.js']],
  ]) {
    execFileSync(
      process.execPath,
      [`node_modules/${tool}`, '-p', `packages/${pkg}/tsconfig.json`, ...flags],
      { stdio: 'inherit' },
    );
  }
}
