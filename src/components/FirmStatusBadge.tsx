import type { FirmStatus } from '@/lib/domain';

// Lifted out of the firms list page in DES-27, when the detail page became the
// second screen to render it. The label is the status itself; the colour
// carries the severity, and both live here so they can't diverge.

const STYLES: Record<FirmStatus, string> = {
  TRIAL: 'bg-taupe/30 text-brown',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  CANCELED: 'bg-brown/10 text-brown/70',
};

const LABELS: Record<FirmStatus, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  CANCELED: 'Canceled',
};

export default function FirmStatusBadge({ status }: { status: FirmStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
