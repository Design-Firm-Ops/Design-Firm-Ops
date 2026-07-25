// Shared mocks for component tests. Import these instead of re-writing
// the same next-auth / next/navigation / fetch scaffolding in every file.
import { vi, type Mock } from 'vitest';
import type { Session } from 'next-auth';

/**
 * A signed-in session — a firm ADMIN by default. Pass overrides for the user.
 *
 * `firmId` defaults to a real value because that's the normal case: only a
 * SUPER_ADMIN has none. Pass `{ role: 'SUPER_ADMIN', firmId: null }` for one.
 */
export function fakeSession(user: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'ADMIN',
      firmId: 'firm-1',
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
 * A spy object shaped like next/navigation's router. Prefer
 * `mockNextNavigation()` below, which wires this up for you.
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

interface NavState {
  pathname: string;
  searchParams: string;
  params: Record<string, string>;
}

let navState: NavState = { pathname: '/app', searchParams: '', params: {} };
let navRouter = createRouterMock();

/**
 * A complete `next/navigation` module mock. Pass it straight to `vi.mock` —
 * because it reads its state lazily, it is safe inside the hoisted factory,
 * which a test-file `const` is not:
 *
 *   vi.mock('next/navigation', () => nextNavigationMock);
 *
 *   const router = mockNextNavigation({ pathname: '/app/vendors' });
 *   expect(router.push).toHaveBeenCalledWith('/app/projects');
 *
 * Mock the *whole* module rather than only the hook a component calls
 * directly: a component that renders a child using a different hook (Nav
 * renders NavSearch, which calls useRouter) throws at render on a partial
 * mock — which is exactly how the Nav tests came to be broken.
 */
export const nextNavigationMock = {
  useRouter: () => navRouter,
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.searchParams),
  useParams: () => navState.params,
  redirect: vi.fn(),
  notFound: vi.fn(),
};

/**
 * Points `nextNavigationMock` at a route and hands back a fresh router spy.
 * Call it in `beforeEach` (or at the top of a test) so spies don't leak
 * between cases.
 */
export function mockNextNavigation({
  pathname = '/app',
  searchParams = '',
  params = {},
}: Partial<NavState> = {}): RouterMock {
  navState = { pathname, searchParams, params };
  navRouter = createRouterMock();
  return navRouter;
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
