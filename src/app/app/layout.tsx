import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/server/auth';
import { firmDenialFor } from '@/server/firmGate';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth alongside middleware.ts — every /app page is
  // internal-only.
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // The firm's lifecycle status, checked per request rather than per token
  // (DES-27). Sessions are JWTs, so without this a suspended firm would keep
  // working until each user's token expired — which isn't a suspension.
  const denial = await firmDenialFor(session);
  if (denial) {
    redirect(`/login?error=${denial}`);
  }

  return (
    <div className="min-h-screen bg-cream">
      <Nav userName={session.user?.name} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
