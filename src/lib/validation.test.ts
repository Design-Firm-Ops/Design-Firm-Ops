import { describe, it, expect } from 'vitest';
import { optionalText, optionalEmail, requiredName, nullableNumber, nullableInt, reorderSchema } from '@/lib/validation';

describe('optionalText', () => {
  const schema = optionalText();

  it('accepts a value, an empty string, or nothing at all', () => {
    expect(schema.parse('hello')).toBe('hello');
    expect(schema.parse('')).toBe('');
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it('rejects a non-string', () => {
    expect(schema.safeParse(42).success).toBe(false);
  });
});

describe('optionalEmail', () => {
  const schema = optionalEmail();

  it('accepts a valid address or an empty string', () => {
    expect(schema.parse('a@b.com')).toBe('a@b.com');
    expect(schema.parse('')).toBe('');
    expect(schema.parse(undefined)).toBeUndefined();
  });

  // The empty-string escape hatch must not swallow genuinely malformed input.
  it('rejects a malformed address', () => {
    expect(schema.safeParse('not-an-email').success).toBe(false);
    expect(schema.safeParse('a@').success).toBe(false);
  });
});

describe('requiredName', () => {
  it('rejects empty and whitespace-free-blank input with the given message', () => {
    const schema = requiredName('Company name is required');
    expect(schema.parse('Acme')).toBe('Acme');
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Company name is required');
  });

  it('defaults to "Name is required"', () => {
    const result = requiredName().safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Name is required');
  });
});

describe('nullableNumber / nullableInt', () => {
  it('turns blank-ish input into null', () => {
    for (const blank of ['', null, undefined]) {
      expect(nullableNumber().parse(blank)).toBeNull();
      expect(nullableInt().parse(blank)).toBeNull();
    }
  });

  it('coerces numeric strings', () => {
    expect(nullableNumber().parse('12.5')).toBe(12.5);
    expect(nullableInt().parse('12')).toBe(12);
  });

  it('rejects negatives and non-integers where the schema says so', () => {
    expect(nullableNumber().safeParse('-1').success).toBe(false);
    expect(nullableInt().safeParse('1.5').success).toBe(false);
  });
});

describe('reorderSchema', () => {
  it('requires a non-empty list of ids', () => {
    expect(reorderSchema.parse({ order: ['a', 'b'] })).toEqual({ order: ['a', 'b'] });
    expect(reorderSchema.safeParse({ order: [] }).success).toBe(false);
    expect(reorderSchema.safeParse({}).success).toBe(false);
  });
});
