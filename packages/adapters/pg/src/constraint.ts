import type { Annotations, Check } from '@opentyped/odb-db';

/** Only infer an entire simple conjunct; never extract a predicate from OR/NOT expressions. */
export function lengthConstraints(checks: readonly Check[], column: string): Annotations {
  const result: Annotations = {};
  const escaped = [...column]
    .map((character) => ('\\^$.*+?()[]{}|'.includes(character) ? `\\${character}` : character))
    .join('')
    .replaceAll('"', '""');
  const identifier = column === 'VALUE' ? 'VALUE' : `(?:"${escaped}"|${escaped})`;
  const operand = `\\(?${identifier}\\)?(?:::text)?`;
  for (const check of checks) {
    if (column !== 'VALUE' && check.columns.length && !check.columns.includes(column)) {
      continue;
    }
    const expression = check.expression
      .trim()
      .replace(/^\((.*)\)$/s, '$1')
      .trim();
    const length = new RegExp(
      `^(?:char_length|length|character_length)\\(${operand}\\)\\s*(<=|>=|=|<|>)\\s*(\\d+)$`,
      'i',
    ).exec(expression);
    if (length) {
      const count = Number(length[2]);
      const op = length[1];
      if (!Number.isSafeInteger(count) || (op === '<' && count === 0)) {
        continue;
      }
      if (op === '<' || op === '<=' || op === '=') {
        result.maxLength = Math.min(result.maxLength ?? Infinity, count - (op === '<' ? 1 : 0));
      }
      if (op === '>' || op === '>=' || op === '=') {
        result.minLength = Math.max(result.minLength ?? 0, count + (op === '>' ? 1 : 0));
      }
    }
  }
  return result;
}
