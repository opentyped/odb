/** Matches Kysely CamelCasePlugin's default snake-to-camel transformation. */
export function camelCase(name: string): string {
  if (!name) {
    return name;
  }
  let result = name[0]!;

  for (let index = 1; index < name.length; index++) {
    const character = name[index]!;

    if (character === '_') {
      continue;
    }
    result += name[index - 1] === '_' ? character.toUpperCase() : character;
  }

  const upper = result.toUpperCase();
  const lower = result.toLowerCase();
  let snake = lower[0]!;

  for (let index = 1; index < result.length; index++) {
    const character = result[index]!;

    if (character === upper[index] && upper[index] !== lower[index]) {
      const previousUpper =
        result[index - 1] === upper[index - 1] && upper[index - 1] !== lower[index - 1];
      snake += `${previousUpper ? '' : '_'}${lower[index]}`;
    } else {
      snake += character;
    }
  }

  if (snake !== name) {
    throw new Error(
      `SQL identifier ${JSON.stringify(name)} cannot round-trip through Kysely CamelCasePlugin (${JSON.stringify(snake)})`,
    );
  }

  return result;
}

/** Unicode letters and digits are words; everything else separates them. */
export function pascal(name: string): string {
  return name.replace(/(^|[^\p{L}\p{N}]+)([\p{L}\p{N}])/gu, (_, _prefix, letter: string) =>
    letter.toUpperCase(),
  );
}

/** ECMAScript IdentifierName, so generated declarations always parse. */
export function isIdentifier(name: string): boolean {
  return /^[\p{ID_Start}_$][\p{ID_Continue}$‌‍]*$/u.test(name);
}

/** Deliberately limited globs: SQL identifier punctuation is always literal. */
export function matches(name: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const expression = [...pattern]
      .map((character) => {
        if (character === '*') {
          return '.*';
        }

        if (character === '?') {
          return '.';
        }

        return '\\^$.*+?()[]{}|'.includes(character) ? `\\${character}` : character;
      })
      .join('');

    return new RegExp(`^${expression}$`, 's').test(name);
  });
}
