// Shared mocks for component tests. Import these instead of re-writing
// the same next-auth / next/navigation / fetch scaffolding in every file.
import { vi, type Mock } from 'vitest';
import type { Session } from 'next-auth';

/** A signed-in session, admin by default. Pass overrides for the user. */
export function fakeSession(user: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'ADMIN',
      ...user,
    },
    expires: '2999-01-01T00:00:00.000Z',
  };
}

export interface RouterMock {
  push: Mock;
  replace: Mock;
  back: Mock;
  forward: Mock;
  refresh: Mock;
  prefetch: Mock;
}

/**
 * A spy object shaped like next/navigation's router. Use it inside a
 * `vi.mock('next/navigation', ...)` factory, then assert on `router.push`:
 *
 *   const router = createRouterMock();
 *   vi.mock('next/navigation', () => ({ useRouter: () => router }));
 */
export function createRouterMock(): RouterMock {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
}

type FetchBody = unknown;
type FetchHandler = FetchBody | ((url: string) => FetchBody);

/**
 * Stubs global.fetch to return JSON. Pass a fixed body, or a function that
 * maps the requested URL to a body. Returns the spy for call assertions.
 * `vitest.setup.ts` restores all global stubs after each test.
 */
export function mockFetch(handler: FetchHandler): Mock {
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const body = typeof handler === 'function' ? (handler as (u: string) => FetchBody)(url) : handler;
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
