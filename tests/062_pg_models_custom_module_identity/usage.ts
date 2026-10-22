import type { Users, Profile } from 'odb/public';
import type { UserID } from '~/types';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type SameId = Assert<Equal<Users['id'], Profile['user_id']>>;
declare const user: Users;
const profile: Profile = { user_id: user.id };
const id: UserID = profile.user_id;
// @ts-expect-error model properties retain the brand declared in the local source module
const plain: Profile = { user_id: 1 };
