import type KanelAccount from '~/kanel/public/Account';
import type { AccountId as KanelAccountId } from '~/kanel/public/Account';
import type KanelInvoice from '~/kanel/billing/Invoice';
import type { Account, AccountId } from 'odb/public';
import type { Invoice as BillingInvoice } from 'odb/billing';
import type { Kysely } from 'kysely';
import type { Database } from 'odb/kysely';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Fields = Assert<Equal<keyof KanelAccount, keyof Account>>;
type Roles = Assert<Equal<KanelAccount['role'], Account['role']>>;
type Domain = Assert<Equal<KanelAccount['balance'], Account['balance']>>;
type KanelReference = Assert<Equal<KanelInvoice['account_id'], KanelAccountId>>;
type Reference = Assert<Equal<BillingInvoice['account_id'], AccountId>>;
declare const db: Kysely<Database>;
declare const account: Account;
const invoice = db
  .insertInto('billing.invoice')
  .values({ id: 1 as BillingInvoice['id'], account_id: account.id });
// @ts-expect-error IDs intentionally include column identity, so old Kanel brands require a mapping during migration
const legacy: AccountId = null! as KanelAccountId;
// @ts-expect-error pg returns time as a string, despite Kanel's default Date mapping
const clock: Date = account.clock!;

import type {
  DB as CodegenDatabase,
  Account as CodegenAccount,
  Role as CodegenRole,
} from './codegen.js';
import type { Selectable } from 'kysely';
import type { Role, Account as PureAccount } from 'odb/public';
import type { AccountView } from 'odb/billing';
type CodegenKeys = Assert<Equal<keyof CodegenDatabase, keyof Database>>;
type CodegenFields = Assert<Equal<keyof Selectable<CodegenAccount>, keyof PureAccount>>;
type CodegenEnum = Assert<Equal<CodegenRole, Role>>;
type CodegenTime = Assert<Equal<Selectable<CodegenAccount>['clock'], PureAccount['clock']>>;
type ViewSourceIdentity = Assert<Equal<AccountView['id'], AccountId | null>>;
// @ts-expect-error codegen currently loses the NOT NULL constraint of this numeric domain
const nullableDomain: PureAccount['balance'] = null! as Selectable<CodegenAccount>['balance'];
