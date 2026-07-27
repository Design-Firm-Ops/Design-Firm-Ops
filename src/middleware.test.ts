import { describe, it, expect } from 'vitest';
import { isAuthorizedFor } from '@/middleware';
import { landingPathFor } from '@/lib/routes';

// The route gate is a security boundary, so every combination of
// {signed out, designer, admin, super-admin} x {/app, /admin} is pinned.

const FIRM_ROLES = ['ADMIN', 'DESIGNER'] as const;

describe('/admin', () => {
  it('admits the super-admin', () => {
    expect(isAuthorizedFor('/admin', 'SUPER_ADMIN')).toBe(true);
    expect(isAuthorizedFor('/admin/firms', 'SUPER_ADMIN')).toBe(true);
    expect(isAuthorizedFor('/admin/firms/abc/edit', 'SUPER_ADMIN')).toBe(true);
  });

  it('refuses firm users, including firm admins', () => {
    for (const role of FIRM_ROLES) {
      expect(isAuthorizedFor('/admin', role), role).toBe(false);
      expect(isAuthorizedFor('/admin/firms', role), role).toBe(false);
    }
  });

  it('refuses an unauthenticated request', () => {
    expect(isAuthorizedFor('/admin', null)).toBe(false);
    expect(isAuthorizedFor('/admin', undefined)).toBe(false);
  });
});

describe('/app', () => {
  it('admits firm users', () => {
    for (const role of FIRM_ROLES) {
      expect(isAuthorizedFor('/app', role), role).toBe(true);
      expect(isAuthorizedFor('/app/projects/123', role), role).toBe(true);
    }
  });

  // The reverse gate. A super-admin has no firmId, so letting them into /app
  // would hand them whichever firm the tenancy fallback resolves.
  it('refuses the super-admin, who belongs to no firm', () => {
    expect(isAuthorizedFor('/app', 'SUPER_ADMIN')).toBe(false);
    expect(isAuthorizedFor('/app/projects/123', 'SUPER_ADMIN')).toBe(false);
  });

  it('refuses an unauthenticated request', () => {
    expect(isAuthorizedFor('/app', null)).toBe(false);
  });
});

describe('path matching', () => {
  // A prefix check must not let /administration through as /admin, or treat
  // /application as /app.
  it('does not match a longer path that merely starts with the same letters', () => {
    expect(isAuthorizedFor('/administration', 'ADMIN')).toBe(true);
    expect(isAuthorizedFor('/administration', 'SUPER_ADMIN')).toBe(true);
    expect(isAuthorizedFor('/applesauce', 'SUPER_ADMIN')).toBe(true);
  });

  it('matches the bare segment as well as its children', () => {
    expect(isAuthorizedFor('/admin', 'SUPER_ADMIN')).toBe(true);
    expect(isAuthorizedFor('/app', 'ADMIN')).toBe(true);
  });

  it('still requires authentication for anything else the matcher catches', () => {
    expect(isAuthorizedFor('/something-else', null)).toBe(false);
    expect(isAuthorizedFor('/something-else', 'DESIGNER')).toBe(true);
  });

  it('does not treat an unrecognized role as the platform operator', () => {
    expect(isAuthorizedFor('/admin', 'ROOT')).toBe(false);
    // ...but it is still a firm-ish session, so /app remains authenticated-only.
    expect(isAuthorizedFor('/app', 'ROOT')).toBe(true);
  });
});

// The property that keeps sign-in from dead-ending.
//
// Before DES-26 every role was sent to /app/projects after logging in, so a
// super-admin was bounced straight back out by the gate above and landed on
// the login form again — signed in, and unable to get anywhere. Pinning
// "where we send you" against "where you're allowed" makes that unbuildable
// rather than merely fixed.
describe('landing pages agree with the gate', () => {
  it('sends every role somewhere it is actually allowed', () => {
    for (const role of ['SUPER_ADMIN', ...FIRM_ROLES]) {
      const landing = landingPathFor(role);
      expect(isAuthorizedFor(landing, role), `${role} lands on ${landing}`).toBe(true);
    }
  });

  it('never lands an authenticated user back on the login page', () => {
    for (const role of ['SUPER_ADMIN', ...FIRM_ROLES]) {
      expect(landingPathFor(role)).not.toBe('/login');
    }
  });
});
