import type { Annotations, Check } from '@opentyped/odb-db';

interface Token {
  text: string;
  start: number;
  end: number;
  identifier: boolean;
}

/** Tokenize enough DDL to retain CHECKs without mistaking strings/comments for SQL. */
function tokens(sql: string): Token[] {
  const result: Token[] = [];
  const lexer =
    /--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[A-Za-z_][\w$]*|[^\s]/g;
  for (const match of sql.matchAll(lexer)) {
    const text = match[0];
    if (text.startsWith('--') || text.startsWith('/*')) {
      continue;
    }
    result.push({
      text,
      start: match.index,
      end: match.index + text.length,
      identifier: /^[A-Za-z_"`[]/.test(text),
    });
  }
  return result;
}

const unquote = (text: string): string =>
  text.startsWith('"')
    ? text.slice(1, -1).replaceAll('""', '"')
    : text.startsWith('`')
      ? text.slice(1, -1).replaceAll('``', '`')
      : text.startsWith('[')
        ? text.slice(1, -1)
        : text;

const fold = (name: string): string =>
  name.replace(/[A-Z]/g, (character) => character.toLowerCase());
export const sameIdentifier = (left: string, right: string): boolean => fold(left) === fold(right);

export function checks(sql: string, columns: readonly string[]): Check[] {
  const input = tokens(sql);
  const output: Check[] = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i]!.text.toUpperCase() !== 'CHECK' || input[i + 1]?.text !== '(') {
      continue;
    }
    const name =
      input[i - 2]?.text.toUpperCase() === 'CONSTRAINT'
        ? unquote(input[i - 1]!.text)
        : `check_${output.length + 1}`;
    const open = input[++i]!;
    let depth = 1;
    const used = new Set<string>();
    while (++i < input.length) {
      const token = input[i]!;
      if (token.text === '(') {
        depth++;
      }
      if (token.text === ')' && --depth === 0) {
        output.push({
          name,
          expression: sql.slice(open.end, token.start),
          columns: [...used],
        });
        break;
      }
      if (token.identifier) {
        const column = columns.find((column) => sameIdentifier(column, unquote(token.text)));
        if (column !== undefined) {
          used.add(column);
        }
      }
    }
  }
  return output;
}

export function annotations(checks: readonly Check[], column: string): Annotations {
  const result: Annotations = {};
  for (const check of checks) {
    const input = tokens(check.expression);
    // SQLite length() counts code points for text, matching JSON Schema string length.
    if (
      input.length < 6 ||
      input[0]!.text.toLowerCase() !== 'length' ||
      input[1]!.text !== '(' ||
      !sameIdentifier(unquote(input[2]!.text), column) ||
      input[3]!.text !== ')'
    ) {
      continue;
    }
    const comparison = input
      .slice(4)
      .map((token) => token.text)
      .join('');
    const match = /^(<=|>=|<|>|=)(\d+)$/.exec(comparison);
    if (!match) {
      continue;
    }
    const op = match[1],
      count = Number(match[2]);
    if (!Number.isSafeInteger(count) || (op === '<' && count === 0)) {
      continue;
    }
    if (['<', '<=', '='].includes(op!)) {
      result.maxLength = Math.min(result.maxLength ?? Infinity, count - (op === '<' ? 1 : 0));
    }
    if (['>', '>=', '='].includes(op!)) {
      result.minLength = Math.max(result.minLength ?? 0, count + (op === '>' ? 1 : 0));
    }
  }
  return result;
}
