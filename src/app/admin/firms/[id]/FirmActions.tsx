'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import { firmActionsFor, type FirmAction } from '@/lib/firmStatus';
import type { FirmStatus } from '@/lib/domain';

// Suspend / reactivate / cancel.
//
// Which buttons appear comes from `firmActionsFor`, the same table the API
// route enforces with — so the UI can't offer a move the server will refuse,
// and the server doesn't trust the UI either way.
//
// Every action goes through ConfirmDialog per the house rule on destructive
// actions. These are reversible (nothing is ever deleted), but they cut a
// firm's people off from their work, which is the part worth pausing over.

interface ConfirmCopy {
  title: string;
  message: string;
  /**
   * "Cancel firm", not "Cancel". The dialog's dismiss button is already called
   * Cancel, so a cancel *action* labelled the same way puts two buttons named
   * Cancel side by side with opposite meanings — the confirm suffix keeps the
   * destructive one unmistakable.
   */
  confirmLabel: string;
}

function confirmCopy(action: FirmAction, firmName: string): ConfirmCopy {
  const confirmLabel = `${action.label} firm`;

  switch (action.to) {
    case 'SUSPENDED':
      return {
        confirmLabel,
        title: `Suspend ${firmName}?`,
        message:
          'Everyone at this firm will be locked out until it is reactivated. No data is deleted.',
      };
    case 'CANCELED':
      return {
        confirmLabel,
        title: `Cancel ${firmName}?`,
        message:
          'The firm loses access immediately. Its data is retained and it can be reactivated later — nothing is deleted.',
      };
    default:
      return {
        confirmLabel,
        title: `${action.label} ${firmName}?`,
        message: 'Everyone at this firm will be able to log in and use it again.',
      };
  }
}

export default function FirmActions({
  firmId,
  firmName,
  status,
}: {
  firmId: string;
  firmName: string;
  status: FirmStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<FirmAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(action: FirmAction) {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/firms/${firmId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action.to }),
    });

    setBusy(false);

    if (!res.ok) {
      // Surfaced rather than swallowed: a refused status change is exactly the
      // thing an operator must not mistake for a successful one.
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'That change could not be applied.');
      return;
    }

    setPending(null);
    router.refresh();
  }

  const actions = firmActionsFor(status);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action) => (
          <button
            key={action.to}
            type="button"
            className={action.severe ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              setError(null);
              setPending(action);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? confirmCopy(pending, firmName).title : ''}
        message={pending ? confirmCopy(pending, firmName).message : ''}
        confirmLabel={pending ? confirmCopy(pending, firmName).confirmLabel : 'Confirm'}
        busy={busy}
        onConfirm={() => pending && apply(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
