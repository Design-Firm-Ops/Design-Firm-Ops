import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { generateUniquePrefix, findOrCreateItemType } from '@/server/itemType';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// Tenancy is not on the session yet (DES-#2), so the firm is resolved by
// `currentFirmId()`. Stub it: these tests are about the find-or-create
// behaviour, not about how the firm is discovered.
const FIRM = 'firm-1';
vi.mock('@/server/firm', () => ({ currentFirmId: async () => FIRM }));


// Prefixes end up in the tag on every line item ("TA-1", "SC-3"), and two
// types sharing one would make tags ambiguous — so uniqueness is the property
// under test, across all three fallback tiers.

const none = () => new Set<string>();

describe('generateUniquePrefix', () => {
  it('uses the first two letters of the name', () => {
    expect(generateUniquePrefix('Table', none())).toBe('TA');
    expect(generateUniquePrefix('Sconce', none())).toBe('SC');
  });

  it('ignores spaces, digits, and punctuation when picking letters', () => {
    expect(generateUniquePrefix('3-Light Fixture', none())).toBe('LI');
    expect(generateUniquePrefix('  chair  ', none())).toBe('CH');
    expect(generateUniquePrefix("Kid's Desk", none())).toBe('KI');
  });

  it('pads a one-letter name out to two characters', () => {
    expect(generateUniquePrefix('X', none())).toBe('XX');
  });

  it('falls back to XX when the name has no letters at all', () => {
    expect(generateUniquePrefix('123', none())).toBe('XX');
    expect(generateUniquePrefix('', none())).toBe('XX');
    expect(generateUniquePrefix('!!!', none())).toBe('XX');
  });

  // Tier 2: pair the first letter with each later letter in the name.
  it('pairs the first letter with a later one when the base is taken', () => {
    expect(generateUniquePrefix('Table', new Set(['TA']))).toBe('TB');
    expect(generateUniquePrefix('Table', new Set(['TA', 'TB']))).toBe('TL');
    expect(generateUniquePrefix('Table', new Set(['TA', 'TB', 'TL']))).toBe('TE');
  });

  // Tier 3: numbered suffixes once the letters run out.
  it('falls back to numbering when every letter pairing is taken', () => {
    const taken = new Set(['TA', 'TB', 'TL', 'TE']);
    expect(generateUniquePrefix('Table', taken)).toBe('TA2');
  });

  it('keeps counting past the first numbered candidate', () => {
    const taken = new Set(['TA', 'TB', 'TL', 'TE', 'TA2', 'TA3']);
    expect(generateUniquePrefix('Table', taken)).toBe('TA4');
  });

  it('skips pairings that are themselves taken', () => {
    // "Ottoman" -> OTTOMAN: base OT is taken and the first pairing (O+T) is
    // just OT again, so it moves on to O+O.
    expect(generateUniquePrefix('Ottoman', new Set(['OT']))).toBe('OO');
  });

  it('numbers immediately for a two-letter name, which has no pairings to try', () => {
    expect(generateUniquePrefix('Ab', new Set(['AB']))).toBe('AB2');
    expect(generateUniquePrefix('Ab', new Set(['AB', 'AB2']))).toBe('AB3');
  });

  // The property that actually matters, exercised in bulk.
  it('never returns a prefix that is already taken', () => {
    const names = ['Table', 'Tabletop', 'Tall Lamp', 'Task Light', 'Tapestry', 'Tab', 'Ta'];
    const taken = new Set<string>();
    for (const name of names) {
      const prefix = generateUniquePrefix(name, taken);
      expect(taken.has(prefix), `${name} -> ${prefix} collided`).toBe(false);
      taken.add(prefix);
    }
    expect(taken.size).toBe(names.length);
  });

  it('is deterministic for the same inputs', () => {
    const taken = new Set(['TA']);
    expect(generateUniquePrefix('Table', taken)).toBe(generateUniquePrefix('Table', taken));
  });
});

describe('findOrCreateItemType', () => {
  beforeEach(() => {
    prismaMock.reset();
  });

  it('reuses an existing type under the same category', async () => {
    prismaMock.itemTypeOption.findUnique.mockResolvedValue({ id: 'it-1' });
    expect(await findOrCreateItemType('Lighting', 'Sconce')).toBe('it-1');
    expect(prismaMock.itemTypeOption.create).not.toHaveBeenCalled();
  });

  it('creates a new type with a prefix unique across every existing type', async () => {
    prismaMock.itemTypeOption.findUnique.mockResolvedValue(null);
    // "SC" is already taken by some other category's type.
    prismaMock.itemTypeOption.findMany.mockResolvedValue([{ tagPrefix: 'SC' }, { tagPrefix: 'TA' }]);
    prismaMock.itemTypeOption.aggregate.mockResolvedValue({ _max: { order: 1 } });
    prismaMock.itemTypeOption.create.mockResolvedValue({ id: 'it-new' });

    expect(await findOrCreateItemType('Lighting', 'Sconce')).toBe('it-new');
    const created = prismaMock.itemTypeOption.create.mock.calls[0][0] as {
      data: { tagPrefix: string; category: string; name: string; order: number };
    };
    // Prefix uniqueness is global, not per-category, so tags stay unambiguous.
    expect(created.data.tagPrefix).not.toBe('SC');
    expect(created.data).toMatchObject({ category: 'Lighting', name: 'Sconce', firmId: FIRM, order: 2 });
  });

  it('trims both category and name', async () => {
    prismaMock.itemTypeOption.findUnique.mockResolvedValue({ id: 'it-1' });
    await findOrCreateItemType('  Lighting  ', '  Sconce  ');
    expect(prismaMock.itemTypeOption.findUnique).toHaveBeenCalledWith({
      where: { firmId_category_name: { firmId: FIRM, category: 'Lighting', name: 'Sconce' } },
    });
  });

  it('needs both a category and a name', async () => {
    for (const [category, name] of [['', 'Sconce'], ['Lighting', ''], [null, null], ['Lighting', '   ']] as const) {
      expect(await findOrCreateItemType(category, name)).toBeNull();
    }
    expect(prismaMock.itemTypeOption.findUnique).not.toHaveBeenCalled();
  });
});
