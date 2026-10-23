import type { Account, AccountId } from 'odb/billing';
import type { BillingAccount, BillingAccountId } from 'odb/public';
import type { Account as RegionalAccount } from 'odb/sales%2Fregion';
import type { AccountTable } from 'odb/kysely/billing';
import type { Database } from 'odb/kysely';
import type { Kysely, Selectable } from 'kysely';
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Parent = Assert<Equal<Account['parent_id'], BillingAccountId>>;
type Region = Assert<Equal<RegionalAccount['billing_id'], AccountId>>;
type ParentModel = Assert<Equal<BillingAccount['id'], Account['parent_id']>>;
type SchemaModel = Assert<Equal<Account, Selectable<AccountTable>>>;
declare const all: Kysely<Database>;
const crossSchemaQuery = all
  .selectFrom('billing.account')
  .innerJoin('billing_account', 'billing_account.id', 'billing.account.parent_id')
  .selectAll();
// @ts-expect-error table keys come from the combined database
all.selectFrom('account');
// @ts-expect-error slash schema names are encoded as a single module path segment
import type { Account as WrongPath } from 'odb/sales/region';

// @ts-expect-error Database is exported once from the root module
import type { Database as SchemaDatabase } from 'odb/kysely/billing';
