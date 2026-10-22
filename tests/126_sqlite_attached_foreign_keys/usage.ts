import type { UserId as MainId, Profile as MainProfile } from 'odb/main';
import type { UserId as BillingId, Profile as BillingProfile } from 'odb/billing';
declare const main: MainId;
declare const billing: BillingId;
const a: MainProfile = { user_id: main };
const b: BillingProfile = { user_id: billing };
// @ts-expect-error SQLite attachments own distinct identity types
const wrong: MainProfile = { user_id: billing };
