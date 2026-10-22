import type { Document, JsonValue } from 'odb/public';
import type { Insertable, Updateable } from 'kysely';
import type { DocumentTable } from 'odb/kysely/public';

const document: Document = {
  json_value: { nested: [1, true, null, 'x'] },
  jsonb_value: null,
  jsonb_default: [],
};
const write: Insertable<DocumentTable> = { json_value: JSON.stringify(document.json_value) };
const update: Updateable<DocumentTable> = { jsonb_value: null };
// @ts-expect-error BigInt is not a JavaScript JSON value
const big: JsonValue = 9223372036854775807n;
// @ts-expect-error undefined is not a JSON value
const missing: JsonValue = { key: undefined };
// @ts-expect-error functions are not serializable JSON values
const callable: JsonValue = () => 1;
// @ts-expect-error JSON input uses serialized text, including arrays
const invalid: Insertable<DocumentTable> = { json_value: [{ value: 'one' }] };
