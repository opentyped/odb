import type { Reference } from '@opentyped/odb-db';

type Tree = string | null | Tree[] | Node;
interface Node {
  tag: string;
  fields: Record<string, Tree>;
}

interface Token {
  value: string;
  symbol: boolean;
  escaped: boolean;
}

/** PostgreSQL escapes scalar tokens; only unescaped parentheses/braces delimit nodes. */
class Reader {
  private offset = 0;
  private readonly tokens: Token[] = [];

  constructor(source: string) {
    let value = '';
    let escaped = false;
    const flush = (): void => {
      if (value) {
        this.tokens.push({ value, escaped, symbol: false });
      }
      value = '';
      escaped = false;
    };
    for (let index = 0; index < source.length; index++) {
      const character = source[index]!;
      if (character === '\\') {
        if (++index >= source.length) {
          throw new Error('Truncated PostgreSQL view escape');
        }
        value += source[index]!;
        escaped = true;
      } else if (/\s/.test(character)) {
        flush();
      } else if ('(){}'.includes(character)) {
        flush();
        this.tokens.push({ value: character, escaped: false, symbol: true });
      } else {
        value += character;
      }
    }
    flush();
  }

  private isField(token: Token | undefined): boolean {
    return token !== undefined && !token.symbol && !token.escaped && token.value.startsWith(':');
  }

  private isSymbol(value: string): boolean {
    const token = this.tokens[this.offset];
    return token?.symbol === true && token.value === value;
  }

  read(depth = 0): Tree {
    if (depth > 512) {
      throw new Error('PostgreSQL view tree is too deeply nested');
    }
    const token = this.tokens[this.offset++];
    if (!token) {
      throw new Error('Truncated PostgreSQL view tree');
    }
    if (!token.symbol) {
      return token.value === '<>' && !token.escaped ? null : token.value;
    }
    if (token.value === '(') {
      const values: Tree[] = [];
      while (!this.isSymbol(')')) {
        values.push(this.read(depth + 1));
      }
      this.offset++;
      return values;
    }
    if (token.value !== '{') {
      throw new Error('Unexpected PostgreSQL view delimiter');
    }
    const tag = this.tokens[this.offset++];
    if (!tag || tag.symbol) {
      throw new Error('Missing PostgreSQL view node tag');
    }
    const fields: Record<string, Tree> = Object.create(null) as Record<string, Tree>;
    while (!this.isSymbol('}')) {
      const field = this.tokens[this.offset++];
      if (!this.isField(field)) {
        throw new Error('Invalid PostgreSQL view node field');
      }
      const values = [this.read(depth + 1)];
      while (!this.isSymbol('}') && !this.isField(this.tokens[this.offset])) {
        values.push(this.read(depth + 1));
      }
      fields[field!.value.slice(1)] = values.length === 1 ? values[0]! : values;
    }
    this.offset++;
    return { tag: tag.value, fields };
  }
}

const node = (tree: Tree | undefined): Node | undefined =>
  tree !== null && typeof tree === 'object' && !Array.isArray(tree) ? tree : undefined;
const list = (tree: Tree | undefined): Tree[] => (Array.isArray(tree) ? tree : []);
const field = (tree: Tree | undefined, key: string): Tree | undefined => node(tree)?.fields[key];
const integer = (tree: Tree | undefined, key: string): number => Number(field(tree, key));

/** Trace only unchanged columns. Ambiguous unions, transforms and recursive CTEs have no source. */
export function viewSources(
  action: string,
  columns: ReadonlyMap<string, Reference>,
): { sources: Map<number, Reference>; warning?: string } {
  try {
    const query = list(new Reader(action).read()).find((entry) => node(entry)?.tag === 'QUERY');
    const sources = new Map<number, Reference>();
    const target = (
      query: Tree,
      position: number,
      parents: Tree[],
      seen: Set<Tree>,
    ): Reference | undefined => {
      if (seen.size > 128 || seen.has(query) || field(query, 'setOperations')) {
        return undefined;
      }
      const entry = list(field(query, 'targetList')).find(
        (entry) => integer(entry, 'resno') === position && field(entry, 'resjunk') !== 'true',
      );
      return variable(field(entry, 'expr'), query, parents, new Set(seen).add(query));
    };
    const variable = (
      expression: Tree | undefined,
      query: Tree,
      parents: Tree[],
      seen: Set<Tree>,
    ): Reference | undefined => {
      if (node(expression)?.tag !== 'VAR' || integer(expression, 'varlevelsup') !== 0) {
        return undefined;
      }
      const position = integer(expression, 'varattno');
      const rangeIndex = integer(expression, 'varno');
      if (
        !Number.isInteger(position) ||
        position <= 0 ||
        !Number.isInteger(rangeIndex) ||
        rangeIndex <= 0
      ) {
        return undefined;
      }
      const range = list(field(query, 'rtable'))[rangeIndex - 1];
      if (!range || seen.has(range)) {
        return undefined;
      }
      const next = new Set(seen).add(range);
      switch (integer(range, 'rtekind')) {
        case 0:
          return columns.get(`${field(range, 'relid')}:${position}`);
        case 1: {
          const subquery = field(range, 'subquery');
          return subquery ? target(subquery, position, [query, ...parents], next) : undefined;
        }
        case 2:
          return variable(list(field(range, 'joinaliasvars'))[position - 1], query, parents, next);
        case 6: {
          if (field(range, 'self_reference') === 'true') {
            return undefined;
          }
          const scope = [query, ...parents][integer(range, 'ctelevelsup')];
          const cte = list(field(scope, 'cteList')).find(
            (entry) => field(entry, 'ctename') === field(range, 'ctename'),
          );
          if (!cte || field(cte, 'cterecursive') === 'true') {
            return undefined;
          }
          const body = field(cte, 'ctequery');
          const level = integer(range, 'ctelevelsup');
          return body && scope
            ? target(body, position, [scope, ...parents.slice(level)], next)
            : undefined;
        }
        // PostgreSQL 18 routes grouped columns through an RTE_GROUP entry.
        case 9:
          return variable(list(field(range, 'groupexprs'))[position - 1], query, parents, next);
        default:
          return undefined;
      }
    };
    if (query) {
      for (const entry of list(field(query, 'targetList'))) {
        const position = integer(entry, 'resno');
        const source = target(query, position, [], new Set());
        if (source) {
          sources.set(position, source);
        }
      }
    }
    return { sources };
  } catch (error) {
    return { sources: new Map(), warning: `View provenance unavailable: ${String(error)}` };
  }
}
