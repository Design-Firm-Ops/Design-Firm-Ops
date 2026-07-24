import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { jsonOrNull } from '@/server/json';

// The distinction this exists to preserve: `undefined` must mean "leave the
// column alone" and `null` must mean "clear it". Confusing the two silently
// wipes a project's saved invoice column config on an unrelated edit.

describe('jsonOrNull', () => {
  it('passes undefined through so Prisma omits the field entirely', () => {
    expect(jsonOrNull(undefined)).toBeUndefined();
  });

  it('translates null into the JSON-null sentinel that clears the column', () => {
    expect(jsonOrNull(null)).toBe(Prisma.JsonNull);
  });

  it('leaves a real value untouched', () => {
    const config = { columns: ['description', 'extended'] };
    expect(jsonOrNull(config)).toBe(config);
  });

  it('does not mistake falsy-but-present values for null', () => {
    expect(jsonOrNull(0)).toBe(0);
    expect(jsonOrNull('')).toBe('');
    expect(jsonOrNull(false)).toBe(false);
  });

  it('keeps an empty object/array as a value rather than a clear', () => {
    const empty = {};
    expect(jsonOrNull(empty)).toBe(empty);
    expect(jsonOrNull([])).not.toBe(Prisma.JsonNull);
  });
});
