import { prisma } from '@/lib/prisma';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">Company Settings</h1>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
