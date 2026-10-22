import type { Users, Profiles, UsersId, ProfilesId } from 'odb/public';
import type { Membership as BillingMembership } from 'odb/billing';
import type { UsersTable, ProfilesTable } from 'odb/kysely/public';
import type { MembershipTable as BillingMembershipTable } from 'odb/kysely/billing';
import type { Selectable } from 'kysely';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type ForeignModel = Assert<Equal<Users['id'], Profiles['user_id']>>;
type ForeignSharedKey = Assert<Equal<Users['id'], BillingMembership['user_id']>>;
type NullableForeign = Assert<Equal<Users['id'] | null, Profiles['reviewer_id']>>;
type UserShape = Assert<Equal<Users, Selectable<UsersTable>>>;
type ProfileShape = Assert<Equal<Profiles, Selectable<ProfilesTable>>>;
type SharedShape = Assert<Equal<BillingMembership, Selectable<BillingMembershipTable>>>;
declare const user: Users;
declare const profile: Profiles;
const id: UsersId = profile.user_id;
const reference: Profiles['user_id'] = user.id;
const membership: BillingMembership = { user_id: user.id };
// @ts-expect-error a profile ID is not a user ID
const wrong: UsersId = profile.id;
// @ts-expect-error primitives cannot replace validated identifiers
const primitive: UsersId = 42;
// @ts-expect-error a nullable foreign key needs narrowing
const nullable: UsersId = profile.reviewer_id;
// @ts-expect-error unrelated IDs remain distinct in pure model code
const profileId: ProfilesId = user.id;
