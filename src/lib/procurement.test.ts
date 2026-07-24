import { describe, it, expect } from 'vitest';
import { DEFAULT_PROCUREMENT_LISTS, DEFAULT_DOCUMENT_FOLDERS } from '@/lib/procurement';
import { itemSchema } from '@/lib/validation';

describe('project defaults', () => {
  // Item.category is free text matched against this project's procurement list
  // names. An item created without a category defaults to "Other Merchandise",
  // so that list has to exist or the item lands in a list that isn't there.
  it("keeps itemSchema's default category as one of the seeded lists", () => {
    const defaultCategory = itemSchema.parse({
      projectId: 'p1',
      name: 'Thing',
      unitCost: 0,
    }).category;

    expect(DEFAULT_PROCUREMENT_LISTS).toContain(defaultCategory);
  });

  it('seeds a non-empty, duplicate-free set of procurement lists', () => {
    expect(DEFAULT_PROCUREMENT_LISTS.length).toBeGreaterThan(0);
    expect(new Set(DEFAULT_PROCUREMENT_LISTS).size).toBe(DEFAULT_PROCUREMENT_LISTS.length);
  });

  it('seeds a non-empty, duplicate-free set of document folders', () => {
    expect(DEFAULT_DOCUMENT_FOLDERS.length).toBeGreaterThan(0);
    expect(new Set(DEFAULT_DOCUMENT_FOLDERS).size).toBe(DEFAULT_DOCUMENT_FOLDERS.length);
  });
});
