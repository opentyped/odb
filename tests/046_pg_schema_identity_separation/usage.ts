import type { AccountId } from 'odb/public';
import type { AccountId as BillingAccountId } from 'odb/billing';
declare const billing: BillingAccountId;
// @ts-expect-error identically named tables in distinct schemas have distinct identities
const account: AccountId = billing;

import type { Account as PublicAccount } from 'odb/public';
import type { Account as BillingAccount } from 'odb/billing';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type PublicId = Assert<Equal<PublicAccount['id'], AccountId>>;
type BillingId = Assert<Equal<BillingAccount['id'], BillingAccountId>>;
// @ts-expect-error models are exported from schema modules, not a flattened root
import type { Account } from 'odb';
