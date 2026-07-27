import { redirect } from 'next/navigation';
import { FIRMS_PATH } from '@/lib/firms';

// /admin is a real entry point, so it lands somewhere rather than 404ing.
// Firms are the console's home screen — everything else in Phase 3 hangs off
// a firm.

export default function AdminPage() {
  redirect(FIRMS_PATH);
}
