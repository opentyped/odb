import assert from 'node:assert/strict';
import { generate } from '../../oapi/packages/compiler/dist/index.js';
import { defaultParsers } from '../../oapi/packages/vite/dist/defaults.js';

// Optional integration check against the sibling oapi workspace; no dependency in published packages.
const { document } = generate(
  {
    root: 'examples/sqlite',
    tsconfig: 'tsconfig.json',
    namespaces: { './models.ts': 'db' },
    info: { title: 'Database models', version: '0.1.0' },
  },
  defaultParsers,
);
const account = document.components.schemas['db.Account'];
assert.equal(account.properties.name.minLength, 2);
assert.equal(account.properties.name.maxLength, 40);
assert.equal(account.properties.nickname.pattern, '^[A-Za-z ]+$');
assert.ok(account.required.includes('nickname'));
console.log('oapi preserved generated model properties, required keys, lengths, and pattern.');
