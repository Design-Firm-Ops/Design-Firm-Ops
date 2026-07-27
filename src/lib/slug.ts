// URL-safe handles for firms.
//
// `Firm.slug` is globally unique and appears in console URLs, so this has two
// jobs: turn a name someone typed into something addressable, and offer a
// distinct candidate when that handle is already taken. Both pure — the
// database decides who wins a race, not this file.

/** Longest slug we'll store. Long enough to stay readable, short enough for a URL. */
const MAX_LENGTH = 60;

/** Used when a name reduces to nothing — a firm still needs an addressable handle. */
const FALLBACK = 'firm';

/**
 * A URL-safe handle for a firm name.
 *
 * Accents are folded rather than dropped ("Café" → "cafe"), because they're
 * ordinary in firm names rather than an edge case. Anything else outside
 * [a-z0-9] becomes a separator, and runs of separators collapse.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    // Strip the combining marks NFKD just separated out, so "é" → "e".
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Apostrophes are intra-word, so they're removed rather than made into
    // separators: "O'Brien" is one word, and "o-brien" reads as two.
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    // Truncation can land mid-separator.
    .replace(/-+$/, '');

  return slug || FALLBACK;
}

/**
 * The `attempt`-th candidate for a base slug: the slug itself, then `-2`, `-3`…
 *
 * Provisioning walks these on a unique-constraint violation rather than
 * checking availability first — between a check and an insert, someone else
 * can take the name, and the database is the only thing that can settle it.
 */
export function nextSlugCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;

  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
}
