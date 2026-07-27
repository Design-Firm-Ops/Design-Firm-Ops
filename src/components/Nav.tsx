'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import NavSearch from './NavSearch';
import NavLinks from './NavLinks';

const links = [
  { href: '/app/projects', label: 'Projects' },
  { href: '/app/business-development', label: 'Business Development' },
  { href: '/app/vendors', label: 'Vendors' },
  { href: '/app/administration', label: 'Documents' },
  { href: '/app/settings', label: 'Settings' },
];

export default function Nav({ userName }: { userName?: string | null }) {
  return (
    <header className="border-b border-taupe/40 bg-brown text-cream">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/app/projects" className="leading-none">
          <span className="logo-mark text-cream">Design Firm Ops</span>
          <span className="logo-sub text-gold">Studio Operations</span>
        </Link>

        <NavLinks links={links} />

        <NavSearch />

        <div className="flex items-center gap-3 text-sm">
          {userName && <span className="text-cream/70">{userName}</span>}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary border-cream/40 text-cream hover:bg-cream/10">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
