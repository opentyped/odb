import type { A, B, Common, Reference } from 'odb/public';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Referenced = Assert<Equal<Common['id'], A['id'] | B['id']>>;
type Nullable = Assert<Equal<Reference['value'], A['id'] | B['id'] | null>>;
declare const a: A;
// @ts-expect-error independent source tables must retain independent brands
const b: B = { id: a.id };
