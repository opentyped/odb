import type { Annotations } from '~/schema';

/** Independent SQL/domain bounds intersect; a weaker outer check cannot loosen them. */
export function mergeAnnotations(...values: readonly (Annotations | undefined)[]): Annotations {
  const result: Annotations = {};

  for (const annotations of values) {
    if (!annotations) {
      continue;
    }
    const previous = { ...result };
    Object.assign(result, annotations);

    for (const key of ['minLength', 'minimum', 'exclusiveMinimum'] as const) {
      if (previous[key] !== undefined && annotations[key] !== undefined) {
        result[key] = Math.max(previous[key], annotations[key]);
      }
    }

    for (const key of ['maxLength', 'maximum', 'exclusiveMaximum'] as const) {
      if (previous[key] !== undefined && annotations[key] !== undefined) {
        result[key] = Math.min(previous[key], annotations[key]);
      }
    }
  }

  return result;
}
