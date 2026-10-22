import {
  schemaDeclarations,
  documentation,
  propertyDeclaration,
  valueDeclarations,
  type DeclarationOptions,
  type Generator,
} from '@opentyped/odb-db';

/** Pure model interfaces; no Kysely or driver dependency in the generated file. */
export function models(options: DeclarationOptions): Generator {
  return {
    name: 'odb:models',
    files: options.files,
    generate(database) {
      const contents = schemaDeclarations(
        database,
        options.prefix ?? 'odb',
        (database) => {
          const sections: string[] = [...valueDeclarations];
          for (const identifier of database.identifiers) {
            sections.push(
              `export type ${identifier.name} = (${identifier.value}) & { readonly __brand: ${JSON.stringify(identifier.brand)} };`,
            );
          }
          for (const relation of database.relations) {
            sections.push(
              [
                `${documentation(relation.comment, {}, true)}export interface ${relation.typeName} {`,
                ...relation.columns
                  .filter((column) => column.value.select !== 'never')
                  .map((column) => propertyDeclaration(column, column.value.select)),
                '}',
              ].join('\n'),
            );
          }
          sections.push(
            [
              'export interface Database {',
              ...database.relations.map(
                (relation) => `  ${JSON.stringify(relation.key)}: ${relation.typeName};`,
              ),
              '}',
            ].join('\n'),
          );
          return sections;
        },
        '',
      );
      const prefix = options.prefix ?? 'odb';
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
