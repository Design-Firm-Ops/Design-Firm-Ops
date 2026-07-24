import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  redirect(session ? '/app/projects' : '/login');
}
