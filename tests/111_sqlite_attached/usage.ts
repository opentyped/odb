import type { Account as MainAccount } from 'odb/main';
import type { Account as BillingAccount } from 'odb/billing';
import type { Scratch } from 'odb/temp';
import type { Database } from 'odb/kysely';
const main: MainAccount = { id: 1 };
const billing: BillingAccount = { id: 2 };
const attached: keyof Database = 'billing.account';
// @ts-expect-error schema types are imported through their schema module
import type { Account } from 'odb';

// @ts-expect-error Database is exported once from the root module
import type { Database as SchemaDatabase } from 'odb/kysely/main';
