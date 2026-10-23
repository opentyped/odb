import type { AccountId, Profile } from 'odb/public';
import type { AccountLeaf, AccountPart } from 'odb/archive';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Leaf = Assert<Equal<AccountLeaf['id'], AccountId>>;
type Part = Assert<Equal<AccountPart['id'], AccountId>>;
type FK = Assert<Equal<Profile['user_id'], AccountId>>;
