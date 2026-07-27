import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { landingPathFor } from '@/lib/routes';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  // Where you belong depends on who you are: a platform operator has no firm,
  // so /app would only bounce them off the gate in middleware.ts.
  redirect(landingPathFor(session?.user?.role));
}
