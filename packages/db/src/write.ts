import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Generation } from '~/schema';

/** Stage all changed files before replacing any destination. Unchanged files keep their mtime. */
export async function writeFiles(
  generation: Generation,
  root = process.cwd(),
  inputs: readonly string[] = [],
): Promise<string[]> {
  const destinations = new Set<string>();
  const protectedFiles = new Set(inputs.map((file) => resolve(root, file)));
  const files = Object.entries(generation.files).map(([file, contents]) => {
    const destination = resolve(root, file);

    if (destinations.has(destination)) {
      throw new Error(`Duplicate output destination ${destination}`);
    }

    if (protectedFiles.has(destination)) {
      throw new Error(`Output would overwrite generation input ${destination}`);
    }
    destinations.add(destination);

    return { destination, contents };
  });
  const staged: { file: string; destination: string }[] = [];
  const changed: string[] = [];

  try {
    for (const { destination, contents } of files) {
      let existing: string | undefined;

      try {
        existing = await readFile(destination, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      if (existing === contents) {
        continue;
      }
      await mkdir(dirname(destination), { recursive: true });
      const file = `${destination}.${randomUUID()}.tmp`;
      staged.push({ file, destination });
      await writeFile(file, contents, 'utf8');
    }

    for (const { file, destination } of staged) {
      await rename(file, destination);
      changed.push(destination);
    }

    return changed;
  } finally {
    await Promise.all(staged.map(({ file }) => rm(file, { force: true })));
  }
}

/** Check committed artifacts without creating directories or changing files. */
export async function verifyFiles(generation: Generation, root = process.cwd()): Promise<void> {
  const stale: string[] = [];

  for (const [file, expected] of Object.entries(generation.files)) {
    try {
      if ((await readFile(resolve(root, file), 'utf8')) !== expected) {
        stale.push(file);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      stale.push(file);
    }
  }

  if (stale.length) {
    throw new Error(`Generated files are stale: ${stale.sort().join(', ')}`);
  }
}
