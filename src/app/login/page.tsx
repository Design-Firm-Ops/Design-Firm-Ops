'use client';

import { useState, FormEvent } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { landingPathFor } from '@/lib/routes';
import { signInErrorMessage } from '@/lib/firmAccess';

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Seeded from the URL so a user bounced out of /app mid-session is told why,
  // rather than meeting a bare login form. `searchParams` arrives as a prop —
  // no useSearchParams, so no Suspense boundary is needed here.
  const [error, setError] = useState<string | null>(
    searchParams?.error ? signInErrorMessage(searchParams.error) : null
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setSubmitting(false);
      // A suspended or canceled firm gets a specific explanation; anything
      // else stays vague, because it would otherwise reveal which addresses
      // have accounts. See src/lib/firmAccess.ts.
      setError(signInErrorMessage(result.error));
      return;
    }

    // Read the session back rather than guessing: where to go depends on the
    // role, and a platform operator sent to /app is bounced straight off the
    // gate in middleware.ts and back to this form.
    const session = await getSession();
    setSubmitting(false);

    router.push(landingPathFor(session?.user?.role));
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <Link href="/" className="leading-none">
            <span className="logo-mark block text-2xl text-brown">Design Firm Ops</span>
            <span className="logo-sub text-taupe">Studio Operations</span>
          </Link>
          <p className="mt-4 text-sm text-brown/60">Sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-brown">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-brown">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-brown/60">
          No account yet?{' '}
          <Link href="/signup" className="text-brown underline hover:text-gold">
            Create your firm
          </Link>
        </p>
      </div>
    </div>
  );
}
