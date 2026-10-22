import {
  schemaDeclarations,
  documentation,
  propertyDeclaration,
  valueDeclarations,
  type DeclarationOptions,
  type Generator,
} from '@opentyped/odb-db';

export function kysely(options: DeclarationOptions): Generator {
  return {
    name: 'odb:kysely',
    files: options.files,
    generate(database) {
      const contents = schemaDeclarations(
        database,
        options.prefix ?? 'odb/kysely',
        (database) => {
          const sections: string[] = [
            "import type { ColumnType, Selectable, Insertable, Updateable } from 'kysely';",
            ...valueDeclarations,
          ];
          for (const identifier of database.identifiers) {
            sections.push(
              `export type ${identifier.name} = (${identifier.value}) & { readonly __brand: ${JSON.stringify(identifier.brand)} };`,
            );
          }
          for (const relation of database.relations) {
            sections.push(
              [
                `${documentation(relation.comment)}export interface ${relation.typeName}Table {`,
                ...relation.columns.map((column) => {
                  const value = column.value;
                  const expression =
                    value.select === value.insert && value.select === value.update
                      ? value.select
                      : `ColumnType<${value.select}, ${value.insert}, ${value.update}>`;
                  return propertyDeclaration(column, expression);
                }),
                '}',
              ].join('\n'),
              `export type ${relation.typeName} = Selectable<${relation.typeName}Table>;`,
              `export type New${relation.typeName} = Insertable<${relation.typeName}Table>;`,
              `export type ${relation.typeName}Update = Updateable<${relation.typeName}Table>;`,
            );
          }
          sections.push(
            [
              'export interface Database {',
              ...database.relations.map(
                (relation) => `  ${JSON.stringify(relation.key)}: ${relation.typeName}Table;`,
              ),
              '}',
            ].join('\n'),
          );
          return sections;
        },
        'Table',
      );
      const prefix = options.prefix ?? 'odb/kysely';
      return {
        modules: [
          prefix,
          ...new Set(
            database.relations.map(
              (relation) => `${prefix}/${encodeURIComponent(relation.schema)}`,
            ),
          ),
        ],
        files: { [options.files.declarations]: contents },
      };
    },
  };
}
