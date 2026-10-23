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

export function models(options: DeclarationOptions): Generator {
  return {
    name: 'odb:models',
    files: options.files,
    generate(database) {
      const prefix = options.prefix ?? 'odb';
      const contents = schemaDeclarations(
        database,
        prefix,
        (database) => {
          const sections: string[] = [...valueDeclarations, ...typeDeclarations(database)];
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

          return sections;
        },
        '',
      );
      return {
        modules: declarationModules(database, prefix),
        files: { [options.files.declarations]: contents },
      };
    },
  };
}
