import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { tenantContext } from '@/server/tenantDb';
import { formatMoney } from '@/lib/money';
import { pricingFor } from '@/lib/billing';
import { isBillingPlan } from '@/lib/validation';
import { APP_HOME } from '@/lib/routes';

export const dynamic = 'force-dynamic';

// The mock billing step.
//
// Deliberately NOT a card form. Billing is a separate concern (DES-28), and a
// realistic-looking payment form that collects nothing would be worse than an
// honest placeholder — someone would eventually type a real card into it.
//
// It runs *after* the firm exists, so nothing here can strand a half-made
// account: skipping this page still leaves a working firm on a trial.

export default async function SignupBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.firmId) redirect('/signup');

  const { db, firmId } = tenantContext(session);
  const firm = await db.firm.findUnique({
    where: { id: firmId },
    select: { name: true, plan: true },
  });
  if (!firm) redirect('/signup');

  // Read back from the firm rather than a query string, so the page can't be
  // made to show a plan the firm isn't on.
  const pricing = isBillingPlan(firm.plan) ? pricingFor(firm.plan) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-medium text-brown">{firm.name} is ready</h1>
        <p className="mt-2 text-sm text-brown/60">
          Your firm is set up with its default offerings, fee structures and lead pipeline.
        </p>

        {pricing && (
          <div className="mt-6 rounded-md border border-taupe/40 bg-taupe/5 p-4 text-left">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-brown">{pricing.label} plan</span>
              <span className="text-brown">
                {formatMoney(pricing.amount)} {pricing.cadence}
              </span>
            </div>
            {pricing.annualSavings.greaterThan(0) && (
              <p className="mt-1 text-xs text-green-800">
                Saving {formatMoney(pricing.annualSavings)} a year against monthly billing.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 rounded-md bg-gold/10 p-3 text-sm text-brown/70">
          <strong className="text-brown">Billing isn’t connected yet.</strong> Nothing has been
          charged and no payment details have been collected — your firm is on a free trial.
        </p>

        <Link href={APP_HOME} className="btn-primary mt-6 inline-block w-full">
          Go to your projects
        </Link>
      </div>
    </div>
  );
}
