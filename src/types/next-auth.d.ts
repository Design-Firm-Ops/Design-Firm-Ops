import type { DefaultSession } from 'next-auth';

type Role = 'ADMIN' | 'DESIGNER' | 'SUPER_ADMIN';

/**
 * `firmId` is the tenant every request belongs to. It is null for exactly one
 * kind of session: a SUPER_ADMIN, who is a platform operator rather than a
 * member of any firm (plans/ADMIN_DASHBOARD.md §3.3). Read it through
 * `getTenantContext` / `requireFirmId` in `@/lib/tenant` rather than reaching
 * into the session directly.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      firmId: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: Role;
    firmId: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    firmId: string | null;
  }
}
