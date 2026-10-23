import type { AccountId, AccountCopy, AccountMat } from 'odb/public';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Copy = Assert<Equal<AccountCopy['id'], AccountId | null>>;
type Mat = Assert<Equal<AccountMat['id'], AccountId | null>>;
