import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { landingPathFor } from '@/lib/routes';
import Marketing from './Marketing';

export const dynamic = 'force-dynamic';

// `/` is the public home page — the front door for someone who has never heard
// of this, with links to register or sign in.
//
// A signed-in visitor never sees it: they're sent wherever they belong, which
// depends on who they are (a platform operator has no firm, so /app would only
// bounce them off the gate in middleware.ts).

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(landingPathFor(session.user?.role));
  }

  return <Marketing />;
}
