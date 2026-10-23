import type { United, Joined, AId, BId } from 'odb/public';
declare const union: United;
declare const join: Joined;
// @ts-expect-error UNION branches with unrelated keys cannot acquire one source brand
const wrong: AId = union.id!;
// @ts-expect-error FULL JOIN USING coalesces two distinct identities
const coalesced: BId = join.id!;
