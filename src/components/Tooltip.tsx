'use client';

// Wraps a control (typically a disabled button) and shows a short
// styled hover box explaining why the action isn't available right now.
// Renders children unchanged when there's no reason to show.

export default function Tooltip({ reason, children }: { reason?: string | null; children: React.ReactNode }) {
  if (!reason) return <>{children}</>;

  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-md bg-brown px-2.5 py-1.5 text-center text-xs font-medium text-cream opacity-0 shadow-md transition-opacity duration-150 group-hover/tooltip:opacity-100">
        {reason}
      </span>
    </span>
  );
}
