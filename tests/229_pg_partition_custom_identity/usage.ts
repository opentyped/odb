import type { UserId } from './identity.js';
import type { Profile, UsersPart } from 'odb/archive';
import type { Users } from 'odb/public';
import type { Profile as KyselyProfile } from 'odb/kysely/archive';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Parent = Assert<Equal<Users['id'], UserId>>;
type Partition = Assert<Equal<UsersPart['id'], UserId>>;
type ForeignKey = Assert<Equal<Profile['user_id'], UserId>>;
type KyselyForeignKey = Assert<Equal<KyselyProfile['user_id'], UserId>>;
