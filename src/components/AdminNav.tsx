'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import NavLinks from './NavLinks';

// The platform console's header.
//
// Deliberately not the firm `Nav`: those links all point into /app, which a
// super-admin is barred from, and the two audiences are different. The palette
// is the same brand, but the chrome is darker and labelled "Platform Console"
// so an operator can tell at a glance which side of the tenancy line they are
// on. That distinction stops being cosmetic in DES-30, when impersonation
// needs to be unmistakable.

const links = [{ href: '/admin/firms', label: 'Firms' }];

export default function AdminNav({ userName }: { userName?: string | null }) {
  return (
    <header className="border-b border-gold/30 bg-brown-dark text-cream">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/admin/firms" className="leading-none">
          <span className="logo-mark text-cream">Design Firm Ops</span>
          <span className="logo-sub text-gold">Platform Console</span>
        </Link>

        <NavLinks links={links} />

        <div className="flex items-center gap-3 text-sm">
          {userName && <span className="text-cream/70">{userName}</span>}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-secondary border-cream/40 text-cream hover:bg-cream/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
