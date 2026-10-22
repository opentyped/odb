import type {
  Identity,
  Identifier,
  ResolveOptions,
  ResolvedColumn,
  ResolvedRelation,
} from '~/schema';

type Entry = { relation: ResolvedRelation; column: ResolvedColumn; key: string };
const keyOf = (schema: string, table: string, column: string): string =>
  JSON.stringify([schema, table, column]);
const pascal = (name: string): string =>
  name.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, _prefix, letter: string) =>
    letter.toUpperCase(),
  );

/** Primary-key foreign keys share an identity; cycles choose a stable representative. */
export function identifiers(
  relations: readonly ResolvedRelation[],
  options: ResolveOptions,
  names: Set<string>,
): { relations: ResolvedRelation[]; identifiers: Identifier[] } {
  const entries = new Map<string, Entry>();

  for (const relation of relations) {
    for (const column of relation.columns) {
      if (!column.primaryKey || column.value.select === 'never') {
        continue;
      }
      const key = keyOf(relation.schema, relation.name, column.name);
      entries.set(key, { relation, column, key });
    }
  }
  const explicitMapping = (entry: Entry): boolean =>
    options.columns?.[`${entry.relation.schema}.${entry.relation.name}.${entry.column.name}`] !==
    undefined;
  const selected = (column: ResolvedColumn): string =>
    column.nullable ? column.value.select.slice(1, -8) : column.value.select;
  const targets = (column: ResolvedColumn): string[] =>
    column.references
      .map((reference) => keyOf(reference.schema, reference.relation, reference.column))
      .filter((key) => {
        const target = entries.get(key);

        return (
          target !== undefined &&
          (explicitMapping(target) || selected(column) === selected(target.column))
        );
      });
  // Collapse directed cycles, rather than merging all referenced keys: a junction
  // referencing two independent tables must not collapse those tables' brands.
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const active = new Set<string>();
  const components: Entry[][] = [];
  const componentOf = new Map<string, number>();
  const visit = (key: string): void => {
    indices.set(key, indices.size);
    low.set(key, indices.get(key)!);
    stack.push(key);
    active.add(key);

    for (const target of targets(entries.get(key)!.column)) {
      if (!indices.has(target)) {
        visit(target);
        low.set(key, Math.min(low.get(key)!, low.get(target)!));
      } else if (active.has(target)) {
        low.set(key, Math.min(low.get(key)!, indices.get(target)!));
      }
    }

    if (low.get(key) !== indices.get(key)) {
      return;
    }
    const component: Entry[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      active.delete(member);
      componentOf.set(member, components.length);
      component.push(entries.get(member)!);
    } while (member !== key);
    components.push(component.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)));
  };

  for (const key of entries.keys()) {
    if (!indices.has(key)) {
      visit(key);
    }
  }

  const expressions = new Map<string, Identity[]>();
  const output: Identifier[] = [];
  const resolveComponent = (index: number): Identity[] => {
    const group = components[index]!;
    const cached = expressions.get(group[0]!.key);

    if (cached) {
      return cached;
    }
    const references = group
      .flatMap((entry) => targets(entry.column))
      .filter((key) => componentOf.get(key) !== index);
    let values = [...new Set(references.flatMap((key) => resolveComponent(componentOf.get(key)!)))];

    if (!values.length) {
      const explicit = group.filter(explicitMapping);

      if (explicit.length) {
        values = [
          ...new Set(explicit.map((entry) => `Exclude<${entry.column.value.select}, null>`)),
        ];
      } else {
        const { relation, column } = group[0]!;
        const composite = relation.columns.filter((field) => field.primaryKey).length > 1;
        const base = `${relation.typeName}${composite ? pascal(column.name) : ''}`;
        const name = base.endsWith('Id') ? base : `${base}Id`;

        if (names.has(`${relation.schema}:${name}`)) {
          throw new Error(`Generated identifier name collision: ${name}; configure name(relation)`);
        }
        names.add(`${relation.schema}:${name}`);
        output.push({
          schema: relation.schema,
          name,
          value: column.value.select,
          brand: `${relation.schema}.${relation.name}.${column.name}`,
        });
        values = [{ schema: relation.schema, name }];
      }
    }

    for (const entry of group) {
      expressions.set(entry.key, values);
    }

    return values;
  };

  for (const key of entries.keys()) {
    resolveComponent(componentOf.get(key)!);
  }

  return {
    identifiers: output,
    relations: relations.map((relation) => ({
      ...relation,
      columns: relation.columns.map((column) => {
        if (options.columns?.[`${relation.schema}.${relation.name}.${column.name}`] !== undefined) {
          return column;
        }
        const own = expressions.get(keyOf(relation.schema, relation.name, column.name));
        const references = targets(column).flatMap((key) => expressions.get(key)!);
        const types = own ?? [...new Set(references)];

        if (!types.length) {
          return column;
        }

        return { ...column, identifiers: types };
      }),
    })),
  };
}
