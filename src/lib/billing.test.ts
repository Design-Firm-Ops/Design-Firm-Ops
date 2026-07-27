import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { planPricing, annualSavings, MONTHLY_PRICE, YEARLY_PRICE } from '@/lib/billing';
import { BILLING_PLANS } from '@/lib/validation';

describe('plan pricing', () => {
  it('covers every billing plan', () => {
    expect(planPricing().map((p) => p.plan).sort()).toEqual([...BILLING_PLANS].sort());
  });

  // The issue asks for yearly "at a discount" — so it must actually be one.
  it('makes yearly cheaper than twelve months', () => {
    expect(YEARLY_PRICE.lessThan(MONTHLY_PRICE.times(12))).toBe(true);
    expect(annualSavings().greaterThan(0)).toBe(true);
  });

  it('states the saving exactly', () => {
    // 49 x 12 = 588, less 490.
    expect(annualSavings().toString()).toBe('98');
  });

  it('shows no saving on the monthly plan', () => {
    expect(planPricing().find((p) => p.plan === 'MONTHLY')!.annualSavings.isZero()).toBe(true);
  });

  // House rule: money is decimal.js, never floats — including here, where the
  // arithmetic is easy enough to tempt someone into a shortcut.
  it('keeps every figure a Decimal', () => {
    for (const pricing of planPricing()) {
      expect(pricing.amount, pricing.plan).toBeInstanceOf(Decimal);
      expect(pricing.annualSavings, pricing.plan).toBeInstanceOf(Decimal);
    }
  });
});
