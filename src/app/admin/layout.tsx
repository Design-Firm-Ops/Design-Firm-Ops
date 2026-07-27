import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/server/auth';
import { isSuperAdmin } from '@/lib/tenant';
import AdminNav from '@/components/AdminNav';

// The platform console.
//
// Not to be confused with `/app/administration`, which is a firm-facing
// documents screen. This area is for the platform operator and is the only
// place in the app that reads across firms (see src/server/platformDb.ts).
//
// Middleware already rejects non-SUPER_ADMIN sessions from /admin (DES-24).
// This is the second lock, matching how `/app/layout.tsx` re-checks the
// session behind the same middleware: a route gate that exists in exactly one
// place is one config change away from not existing.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin(session)) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav userName={session?.user?.name} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
