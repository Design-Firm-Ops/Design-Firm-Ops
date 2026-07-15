import { prisma } from '@/lib/prisma';
import ClientsManager from './ClientsManager';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">Clients</h1>
      <ClientsManager initialClients={clients} />
    </div>
  );
}
