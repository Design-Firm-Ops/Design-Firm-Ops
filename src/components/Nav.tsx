'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import NavSearch from './NavSearch';

const links = [
  { href: '/app/projects', label: 'Projects' },
  { href: '/app/business-development', label: 'Business Development' },
  { href: '/app/vendors', label: 'Vendors' },
  { href: '/app/administration', label: 'Administration' },
  { href: '/app/settings', label: 'Settings' },
];

export default function Nav({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-taupe/40 bg-brown text-cream">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/app/projects" className="letterspaced-title text-sm font-semibold">
          M D I&nbsp; S T U D I O
        </Link>

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  active ? 'bg-gold/90 text-brown' : 'hover:bg-cream/10'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

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
