import { trialStatus, trialMessage } from '@/lib/trial';

// Shown across the top of /app while a firm is on its trial.
//
// Renders nothing unless there is actually a trial to report — a firm with no
// trial date, or one that isn't on TRIAL any more, sees no banner at all
// rather than an empty bar.
//
// The copy deliberately doesn't threaten a lockout: nothing cuts access off
// when a trial ends today (DES-27's gate only blocks SUSPENDED and CANCELED),
// and a banner that implied otherwise would be a lie the product doesn't tell.

export default function TrialBanner({
  status,
  trialEndsAt,
  now = new Date(),
}: {
  status: string;
  trialEndsAt: Date | null;
  now?: Date;
}) {
  if (status !== 'TRIAL') return null;

  const trial = trialStatus(trialEndsAt, now);
  if (!trial) return null;

  return (
    <div
      role="status"
      className={`border-b px-4 py-2 text-center text-sm sm:px-6 ${
        trial.expired ? 'border-red-200 bg-red-50 text-red-800' : 'border-gold/40 bg-gold/15 text-brown'
      }`}
    >
      <span className="font-medium">{trialMessage(trial)}</span>{' '}
      <span className="text-brown/60">Billing isn’t connected yet — nothing has been charged.</span>
    </div>
  );
}
