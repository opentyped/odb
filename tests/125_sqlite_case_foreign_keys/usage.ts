import type { Child, Parent } from 'odb/main';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Foreign = Assert<Equal<Parent['Id'], Child['ParentId']>>;
