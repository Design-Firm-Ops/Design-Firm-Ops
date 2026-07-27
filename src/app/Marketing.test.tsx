import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test';
import Marketing from './Marketing';
import { planPricing } from '@/lib/billing';
import { formatMoney } from '@/lib/money';

// The public home page. Its job is to explain what this is and offer the two
// ways in, so those are what get pinned — plus the claims it makes, which have
// to stay true.

const linksTo = (href: string) =>
  screen.getAllByRole('link').filter((a) => a.getAttribute('href') === href);

describe('Marketing', () => {
  it('offers both ways in', () => {
    renderWithProviders(<Marketing />);
    expect(linksTo('/signup').length, 'no way to register').toBeGreaterThan(0);
    expect(linksTo('/login').length, 'no way to sign in').toBeGreaterThan(0);
  });

  it('says what the product is', () => {
    renderWithProviders(<Marketing />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/lead to final invoice/i);
  });

  it('describes what the app actually does', () => {
    renderWithProviders(<Marketing />);
    for (const feature of ['Business development', 'Projects', 'FF&E procurement', 'Invoicing']) {
      expect(screen.getByRole('heading', { name: feature })).toBeInTheDocument();
    }
  });

  // The price quoted here and the price charged at sign-up come from one
  // source; this fails if the page ever hardcodes its own number.
  it('quotes the real prices', () => {
    renderWithProviders(<Marketing />);
    for (const plan of planPricing()) {
      expect(screen.getAllByText(formatMoney(plan.amount)).length, plan.plan).toBeGreaterThan(0);
    }
    expect(screen.getByText(/save \$98\.00 a year/i)).toBeInTheDocument();
  });

  // Sign-up creates a TRIAL firm and the billing page is a mock that collects
  // nothing, so this claim is true — and must stay true.
  it('only promises a trial that the flow actually delivers', () => {
    renderWithProviders(<Marketing />);
    expect(screen.getByText(/free trial. no card required/i)).toBeInTheDocument();
  });

  // A marketing page is the easiest place for an invented number or a
  // fabricated quote to appear. There are none, and this keeps it that way.
  it('makes no claims about customers it does not have', () => {
    const { container } = renderWithProviders(<Marketing />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/trusted by|loved by|customers worldwide|join \d/i);
    expect(text).not.toMatch(/\d+[,\d]*\+?\s*(firms|studios|designers|users|customers)/i);
    // No testimonial attributions.
    expect(text).not.toMatch(/[“"][^"”]{20,}[”"]\s*—/);
  });
});
