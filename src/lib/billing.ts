import Decimal from 'decimal.js';
import type { BillingPlan } from '@/lib/validation';

// Plan pricing for the sign-up page.
//
// Billing itself is mocked for now (DES-28) — nothing is charged and no payment
// details are collected. These figures exist so the monthly/yearly choice the
// flow asks for is a real comparison rather than two unlabelled buttons.
//
// Money is decimal.js per the house rule, even here: the yearly discount is
// derived arithmetic, and "it's only marketing copy" is exactly how a rounding
// habit escapes into the parts that bill people.

/** Monthly price, in dollars, when paying month to month. */
export const MONTHLY_PRICE = new Decimal(49);

/** Yearly price, in dollars, paid once — two months off. */
export const YEARLY_PRICE = new Decimal(490);

export interface PlanPricing {
  plan: BillingPlan;
  label: string;
  /** What the customer is charged, per billing period. */
  amount: Decimal;
  cadence: string;
  /** Amount saved per year against paying monthly; zero for the monthly plan. */
  annualSavings: Decimal;
}

/** The yearly plan's saving against twelve monthly payments. */
export function annualSavings(): Decimal {
  return MONTHLY_PRICE.times(12).minus(YEARLY_PRICE);
}

export function planPricing(): PlanPricing[] {
  return [
    {
      plan: 'MONTHLY',
      label: 'Monthly',
      amount: MONTHLY_PRICE,
      cadence: 'per month',
      annualSavings: new Decimal(0),
    },
    {
      plan: 'YEARLY',
      label: 'Yearly',
      amount: YEARLY_PRICE,
      cadence: 'per year',
      annualSavings: annualSavings(),
    },
  ];
}

