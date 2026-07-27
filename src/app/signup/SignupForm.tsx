'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { APP_HOME } from '@/lib/routes';

// Public sign-up: creates a firm and its first admin.
//
// On success it signs in with the credentials just set, rather than the API
// handing back a session. That keeps exactly one path that mints a session —
// the one with the firm-status gate on it (DES-27).
//
// No plan is chosen here and there is no billing step: every firm starts on a
// free trial and goes straight to the app, with the countdown shown by
// TrialBanner. Asking someone to pick a price before they've seen the product
// was a step that bought nothing.

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmName: String(form.get('firmName') ?? ''),
        adminName: String(form.get('adminName') ?? ''),
        email,
        password,
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const body = await res.json().catch(() => null);
      // Zod's flattened errors are an object; anything else is already a string.
      const message = typeof body?.error === 'string' ? body.error : null;
      setError(message ?? 'Please check the form and try again.');
      return;
    }

    const result = await signIn('credentials', { email, password, redirect: false });
    setSubmitting(false);

    if (result?.error) {
      // The firm exists — say so, rather than implying the sign-up failed.
      setError('Your firm was created, but signing in failed. Please sign in.');
      return;
    }

    router.push(APP_HOME);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="firmName" className="mb-1 block text-sm font-medium text-brown">
          Firm name
        </label>
        <input id="firmName" name="firmName" required maxLength={120} className="input" />
      </div>

      <div>
        <label htmlFor="adminName" className="mb-1 block text-sm font-medium text-brown">
          Your name
        </label>
        <input id="adminName" name="adminName" required maxLength={120} className="input" />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-brown">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-brown">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
        <p className="mt-1 text-xs text-brown/50">At least 8 characters.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Creating your firm…' : 'Create firm'}
      </button>
    </form>
  );
}
