import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/server/auth';
import { loadFirmGate } from '@/server/firmGate';
import { loginDenialFor } from '@/lib/firmAccess';
import TrialBanner from '@/components/TrialBanner';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth alongside middleware.ts — every /app page is
  // internal-only.
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // One read serves both jobs below.
  const firm = await loadFirmGate(session);

  // The firm's lifecycle status, checked per request rather than per token
  // (DES-27). Sessions are JWTs, so without this a suspended firm would keep
  // working until each user's token expired — which isn't a suspension.
  const denial = loginDenialFor(firm?.status);
  if (denial) {
    redirect(`/login?error=${denial}`);
  }

  return (
    <div className="min-h-screen bg-cream">
      <Nav userName={session.user?.name} />
      {firm && <TrialBanner status={firm.status} trialEndsAt={firm.trialEndsAt} />}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
