'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isUnder } from '@/lib/routes';

// The link list shared by the firm nav and the /admin console nav.
//
// Only this much is shared on purpose. The two headers look different and
// should stay free to diverge — the console will grow an impersonation banner
// (DES-30) that has no business appearing in the firm nav. What they must not
// diverge on is which section counts as "current", which is this component.

export interface NavLink {
  href: string;
  label: string;
}

export default function NavLinks({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {links.map((link) => {
        const active = isUnder(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            // aria-current is what makes "which tab is selected" available to
            // assistive tech, rather than being carried only by a background
            // colour.
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              active ? 'bg-cream text-brown' : 'hover:bg-cream/10'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
