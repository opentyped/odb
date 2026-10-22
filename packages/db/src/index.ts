export type * from '~/schema';
export { TypeResolver, resolve } from '~/resolve';
export { defineConfig, generate } from '~/generate';
export {
  declarationFile,
  schemaDeclarations,
  documentation,
  propertyDeclaration,
  valueDeclarations,
} from '~/declaration';
export type { DeclarationOptions } from '~/declaration';
export { mergeAnnotations } from '~/annotation';
