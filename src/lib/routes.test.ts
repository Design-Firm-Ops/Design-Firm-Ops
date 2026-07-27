import { describe, it, expect } from 'vitest';
import { isUnder, landingPathFor } from '@/lib/routes';

describe('isUnder', () => {
  it('matches the section root and its children', () => {
    expect(isUnder('/admin', '/admin')).toBe(true);
    expect(isUnder('/admin/firms', '/admin')).toBe(true);
    expect(isUnder('/admin/firms/firm-a', '/admin')).toBe(true);
  });

  // The reason this isn't a bare startsWith. `/admin` must not claim
  // `/administration`, and in the nav `/admin/firms` must not claim
  // `/admin/firms-archive` — one is a route gate, the other is which tab
  // looks selected, and both get it wrong the same way.
  it('does not match a section that is merely a string prefix', () => {
    expect(isUnder('/administration', '/admin')).toBe(false);
    expect(isUnder('/admin/firms-archive', '/admin/firms')).toBe(false);
  });

  it('does not match an unrelated path', () => {
    expect(isUnder('/app/projects', '/admin')).toBe(false);
    expect(isUnder('/', '/admin')).toBe(false);
  });

  it('handles an empty or missing pathname', () => {
    expect(isUnder('', '/admin')).toBe(false);
    expect(isUnder(null, '/admin')).toBe(false);
    expect(isUnder(undefined, '/admin')).toBe(false);
  });
});

describe('landingPathFor', () => {
  it('sends the platform operator to the console', () => {
    expect(landingPathFor('SUPER_ADMIN')).toBe('/admin');
  });

  it('sends firm users to their projects', () => {
    expect(landingPathFor('ADMIN')).toBe('/app/projects');
    expect(landingPathFor('DESIGNER')).toBe('/app/projects');
  });

  it('sends a signed-out visitor to the login page', () => {
    expect(landingPathFor(null)).toBe('/login');
    expect(landingPathFor(undefined)).toBe('/login');
  });

  // An unrecognized role is not the platform operator, so it must not be
  // handed the console.
  it('does not send an unrecognized role to the console', () => {
    expect(landingPathFor('ROOT')).toBe('/app/projects');
  });
});
