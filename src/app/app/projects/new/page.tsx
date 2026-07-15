import { prisma } from '@/lib/prisma';
import NewProjectForm from './NewProjectForm';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">New Project</h1>
      <NewProjectForm clients={clients} />
    </div>
  );
}
