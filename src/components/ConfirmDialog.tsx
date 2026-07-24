'use client';

// A reusable confirmation modal for destructive actions (delete
// client/vendor/item/document, etc). Every destructive action in the
// app should route through this rather than firing immediately.

import Modal from './Modal';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    // Elevated because a confirm usually opens on top of the form that
    // triggered it. Dismissing is always "cancel", never the destructive
    // action — and it's disabled entirely while the action is in flight.
    <Modal open={open} onClose={busy ? undefined : onCancel} width="sm" elevated>
      <h2 className="text-lg font-medium text-brown">{title}</h2>
      <p className="mt-2 text-sm text-brown/70">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
