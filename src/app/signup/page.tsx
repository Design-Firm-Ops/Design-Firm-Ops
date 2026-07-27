import Link from 'next/link';
import SignupForm from './SignupForm';

// Public — `middleware.ts` matches only /app and /admin, and a test pins that
// so a later matcher edit can't quietly put a wall in front of sign-up.

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="logo-mark text-2xl text-brown">Design Firm Ops</h1>
          <p className="logo-sub text-taupe">Studio Operations</p>
          <p className="mt-4 text-sm text-brown/60">Create your firm</p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-brown/60">
          Already have an account?{' '}
          <Link href="/login" className="text-brown underline hover:text-gold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
