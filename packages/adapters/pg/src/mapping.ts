import type { TypeMapping } from '@opentyped/odb-db';

// Defaults target node-postgres 8's pg-types 2.x text parsers, not SQL storage types.
export function builtin(name: string): TypeMapping {
  if (name === 'void') {
    return { select: 'void' };
  }
  if (
    [
      'any',
      'anyelement',
      'anyarray',
      'anynonarray',
      'anyenum',
      'anyrange',
      'anymultirange',
      'anycompatible',
      'anycompatiblearray',
      'anycompatiblenonarray',
      'anycompatiblerange',
      'anycompatiblemultirange',
      'record',
      'internal',
      'cstring',
      'trigger',
      'event_trigger',
      'language_handler',
      'fdw_handler',
      'index_am_handler',
      'table_am_handler',
      'tsm_handler',
    ].includes(name)
  ) {
    return { select: 'unknown' };
  }
  if (['int2', 'int4', 'oid', 'float4', 'float8'].includes(name)) {
    return { select: 'number' };
  }
  if (name === 'bool') {
    return { select: 'boolean' };
  }
  if (name === 'int8') {
    return { select: 'string', insert: 'string | number | bigint' };
  }
  if (name === 'numeric') {
    return { select: 'string', insert: 'string | number' };
  }
  if (['date', 'timestamp', 'timestamptz'].includes(name)) {
    return { select: 'Date | number', insert: 'Date | string | number' };
  }
  if (['json', 'jsonb'].includes(name)) {
    return { select: 'JsonValue', insert: 'string', annotations: { jsonSchema: {} } };
  }
  if (name === 'bytea') {
    return { select: "import('node:buffer').Buffer" };
  }
  if (name === 'point') {
    return { select: '{ x: number; y: number }', insert: 'string' };
  }
  if (name === 'circle') {
    return { select: '{ x: number; y: number; radius: number }', insert: 'string' };
  }
  if (name === 'interval') {
    return {
      select:
        '{ years?: number; months?: number; days?: number; hours?: number; minutes?: number; seconds?: number; milliseconds?: number }',
      insert: 'string',
    };
  }
  return { select: 'string', ...(name === 'uuid' ? { annotations: { format: 'uuid' } } : {}) };
}

/** Registered text-array parsers in pg-types 2.x. Other arrays arrive as raw text. */
export const parsedArrays = new Set([
  '_bool',
  '_bytea',
  '_int2',
  '_int4',
  '_int8',
  '_oid',
  '_float4',
  '_float8',
  '_numeric',
  '_char',
  '_bpchar',
  '_varchar',
  '_text',
  '_date',
  '_time',
  '_timetz',
  '_timestamp',
  '_timestamptz',
  '_interval',
  '_json',
  '_jsonb',
  '_uuid',
  '_cidr',
  '_inet',
  '_macaddr',
  '_point',
  '_money',
  '_numrange',
]);
