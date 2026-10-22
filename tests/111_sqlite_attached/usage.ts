import type { Account as MainAccount } from 'odb/main';
import type { Account as BillingAccount } from 'odb/billing';
import type { Scratch } from 'odb/temp';
import type { Database as BillingDatabase } from 'odb/kysely/billing';
import type { Database } from 'odb/kysely';
const main: MainAccount = { id: 1 };
const billing: BillingAccount = { id: 2 };
const table: keyof BillingDatabase = 'account';
const attached: keyof Database = 'billing.account';
// @ts-expect-error schema types are imported through their schema module
import type { Account } from 'odb';
