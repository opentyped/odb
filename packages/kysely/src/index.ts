import {
  schemaDeclarations,
  declarationModules,
  documentation,
  propertyDeclaration,
  valueDeclarations,
  typeDeclarations,
  type DeclarationOptions,
  type Generator,
} from '@opentyped/odb-db';

export function kysely(options: DeclarationOptions): Generator {
  return {
    name: 'odb:kysely',
    files: options.files,
    generate(database) {
      const prefix = options.prefix ?? 'odb/kysely';
      const contents = schemaDeclarations(
        database,
        prefix,
        (database) => {
          const sections: string[] = [
            "import type { ColumnType, Selectable, Insertable, Updateable } from 'kysely';",
            ...valueDeclarations,
            ...typeDeclarations(database),
          ];
          for (const identifier of database.identifiers) {
            sections.push(
              `export type ${identifier.name} = (${identifier.value}) & { readonly __brand: ${JSON.stringify(identifier.brand)} };`,
            );
          }
          for (const relation of database.relations) {
            sections.push(
              [
                `${documentation(relation.comment, {}, false)}export interface ${relation.typeName}Table {`,
                ...relation.columns.map((column) =>
                  propertyDeclaration(
                    column,
                    column.value.select === column.value.insert &&
                      column.value.select === column.value.update
                      ? column.value.select
                      : `ColumnType<${column.value.select}, ${column.value.insert}, ${column.value.update}>`,
                  ),
                ),
                '}',
              ].join('\n'),
            );
            sections.push(
              `export type ${relation.typeName} = Selectable<${relation.typeName}Table>;`,
              `export type New${relation.typeName} = Insertable<${relation.typeName}Table>;`,
              `export type ${relation.typeName}Update = Updateable<${relation.typeName}Table>;`,
            );
          }

          return sections;
        },
        'Table',
      );
      return {
        modules: declarationModules(database, prefix),
        files: { [options.files.declarations]: contents },
      };
    },
  };
}
