import { withAuth } from 'next-auth/middleware';

// Everything under /app is internal-only (the two MDI owners).
// /portal is intentionally public — clients reach it via tokenized
// links, not accounts.
export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: ['/app/:path*'],
};
