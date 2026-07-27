import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { planPricing } from '@/lib/billing';

// The public home page.
//
// Everything here describes what the app actually does — leads, projects, FF&E
// procurement, trade accounts, invoicing, payments. No invented testimonials,
// customer counts or logos: this is the first page a real prospect sees, and a
// fabricated one would be a lie told at scale.
//
// Pricing comes from `planPricing()`, the same source the sign-up form and the
// billing page use, so the number quoted here can't drift from the number
// charged.

const FEATURES = [
  {
    title: 'Business development',
    body: 'Track leads through a pipeline you define, from first contact to won or lost.',
  },
  {
    title: 'Projects',
    body: 'Clients, rooms, budgets and documents for every engagement, in one place.',
  },
  {
    title: 'FF&E procurement',
    body: 'Specify items by room and list, with tags, dimensions and per-item status.',
  },
  {
    title: 'Vendors & trade accounts',
    body: 'Your vendor list with trade-account credentials encrypted at rest.',
  },
  {
    title: 'Invoicing',
    body: 'Procurement and design-fee invoices as branded PDFs, emailed from the app.',
  },
  {
    title: 'Payments',
    body: 'Record payments against invoices and see what each project is owed.',
  },
];

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="font-medium text-brown">{title}</h3>
      <p className="mt-1 text-sm text-brown/70">{body}</p>
    </div>
  );
}

export default function Marketing() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-taupe/40 bg-brown text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="leading-none">
            <span className="logo-mark text-cream">Design Firm Ops</span>
            <span className="logo-sub text-gold">Studio Operations</span>
          </Link>

          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="rounded-md px-3 py-1.5 transition-colors hover:bg-cream/10">
              Sign in
            </Link>
            <Link href="/signup" className="btn-gold">
              Create your firm
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="eyebrow text-taupe">For interior design studios</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight text-brown sm:text-5xl">
            Run the whole engagement, from first lead to final invoice.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-brown/70">
            Design Firm Ops keeps leads, projects, FF&amp;E procurement, vendor accounts,
            invoicing and payments in one place — so the studio stops running on
            spreadsheets and inbox threads.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary">
              Create your firm
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-sm text-brown/50">
            Starts on a free trial. No card required.
          </p>
        </section>

        <section className="border-y border-taupe/30 bg-taupe/5 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-serif text-3xl text-brown">Everything the studio runs on</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Feature key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center font-serif text-3xl text-brown">Pricing</h2>
          <p className="mt-3 text-center text-brown/70">
            One price for the whole studio. Every feature on both plans.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {planPricing().map((plan) => (
              // Flex column with the button pushed to the bottom: only the
              // yearly card has a savings line, and without this its button
              // sits lower than the monthly one.
              <div key={plan.plan} className="card flex flex-col p-6 text-center">
                <h3 className="font-medium text-brown">{plan.label}</h3>
                <p className="mt-2 font-serif text-3xl text-brown">{formatMoney(plan.amount)}</p>
                <p className="text-sm text-brown/60">{plan.cadence}</p>
                {plan.annualSavings.greaterThan(0) && (
                  <p className="mt-2 text-sm text-green-800">
                    Save {formatMoney(plan.annualSavings)} a year
                  </p>
                )}
                <div className="mt-auto pt-5">
                  <Link href="/signup" className="btn-secondary block w-full">
                    Get started
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-taupe/30 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-brown/50 sm:px-6">
          <span>Design Firm Ops</span>
          <nav className="flex gap-4">
            <Link href="/login" className="hover:text-brown">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-brown">
              Create your firm
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
