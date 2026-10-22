import type { Config, Generation, ResolvedDatabase } from '~/schema';
import { resolve } from '~/resolve';

export function defineConfig<T extends Config>(config: T): T {
  return config;
}

/** Read once, resolve once, then pass the same populated model to every generator. */
export async function generate(
  config: Config,
): Promise<Generation & { database: ResolvedDatabase }> {
  const database = resolve(await config.source.read(), config);
  const modules = new Set<string>();
  const files: Record<string, string> = Object.create(null) as Record<string, string>;

  for (const generator of config.generators) {
    const declared = Object.values(generator.files);
    const output = await generator.generate(database);

    for (const [file, content] of Object.entries(output.files)) {
      if (!declared.includes(file)) {
        throw new Error(`${generator.name} emitted undeclared file ${file}`);
      }

      if (Object.hasOwn(files, file)) {
        throw new Error(`Multiple generators emit ${file}`);
      }
      files[file] = content;
    }

    for (const file of declared) {
      if (!Object.hasOwn(output.files, file)) {
        throw new Error(`${generator.name} did not emit declared file ${file}`);
      }
    }

    for (const module of output.modules ?? []) {
      if (modules.has(module)) {
        throw new Error(
          `Multiple generators declare ambient module ${module}; configure distinct prefixes`,
        );
      }
      modules.add(module);
    }
  }

  return { database, files };
}
