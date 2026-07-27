import { describe, it, expect } from 'vitest';
import { slugify, nextSlugCandidate } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Madison Ditton Interiors')).toBe('madison-ditton-interiors');
  });

  it('drops punctuation rather than encoding it', () => {
    expect(slugify('Harbor & Pine Design Co.')).toBe('harbor-pine-design-co');
    expect(slugify("O'Brien Studio")).toBe('obrien-studio');
  });

  it('collapses and trims separators', () => {
    expect(slugify('  Westland   Reserve  ')).toBe('westland-reserve');
    expect(slugify('A -- B')).toBe('a-b');
    expect(slugify('-leading and trailing-')).toBe('leading-and-trailing');
  });

  // Firm names are typed by people; accented characters are ordinary, not edge cases.
  it('folds accents to their ascii base', () => {
    expect(slugify('Café Noir Désign')).toBe('cafe-noir-design');
  });

  it('keeps digits', () => {
    expect(slugify('Studio 54 Interiors')).toBe('studio-54-interiors');
  });

  // The slug ends up in URLs, so a name that reduces to nothing must still
  // produce something addressable rather than an empty path segment.
  it('never returns an empty slug', () => {
    for (const name of ['', '   ', '!!!', '—', '你好']) {
      expect(slugify(name), JSON.stringify(name)).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('bounds the length', () => {
    const slug = slugify('A'.repeat(200));
    expect(slug.length).toBeLessThanOrEqual(60);
    // …and doesn't end on a hyphen after truncating.
    expect(slug).not.toMatch(/-$/);
  });
});

describe('nextSlugCandidate', () => {
  // Two firms may share a name, so the second one needs a slug, not an error.
  it('suffixes on the first collision', () => {
    expect(nextSlugCandidate('harbor-design', 0)).toBe('harbor-design');
    expect(nextSlugCandidate('harbor-design', 1)).toBe('harbor-design-2');
    expect(nextSlugCandidate('harbor-design', 2)).toBe('harbor-design-3');
  });

  it('keeps the suffixed slug within the length bound', () => {
    const long = 'a'.repeat(60);
    expect(nextSlugCandidate(long, 5).length).toBeLessThanOrEqual(60);
    expect(nextSlugCandidate(long, 5)).toMatch(/-6$/);
  });

  it('produces a different candidate for every attempt', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => nextSlugCandidate('studio', i)));
    expect(seen.size).toBe(20);
  });
});
