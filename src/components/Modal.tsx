'use client';

import { useEffect, useRef } from 'react';

// The shared modal shell. Every dialog in the app was hand-rolling the same
// fixed overlay + `card` panel; this owns that markup, plus the keyboard and
// focus behaviour those copies never had.

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
} as const;

export type ModalWidth = keyof typeof WIDTHS;

export default function Modal({
  open = true,
  onClose,
  width = 'md',
  /** Let the overlay scroll when the panel is taller than the viewport (long forms). */
  scrollable = false,
  /** Raises the overlay above another modal — a confirm on top of a form. */
  elevated = false,
  /** Renders the panel as a <form>. Most dialogs here submit something. */
  onSubmit,
  labelledBy,
  className = '',
  children,
}: {
  open?: boolean;
  onClose?: () => void;
  width?: ModalWidth;
  scrollable?: boolean;
  elevated?: boolean;
  onSubmit?: (e: React.FormEvent) => void;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !onClose) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose!();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // The page behind a modal shouldn't scroll with it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${elevated ? 'z-50' : 'z-40'} flex items-center justify-center bg-black/40 px-4 ${
        scrollable ? 'overflow-y-auto py-8' : ''
      }`}
      // A click that starts inside the panel and ends on the overlay (a drag
      // out of a text field) shouldn't close the dialog — only a click that
      // both starts and ends on the overlay itself.
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      {onSubmit ? (
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          onSubmit={onSubmit}
          className={`card w-full ${WIDTHS[width]} p-6 ${className}`}
        >
          {children}
        </form>
      ) : (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`card w-full ${WIDTHS[width]} p-6 ${className}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
