import { describe, it, expect } from 'vitest';
import { isItemLocked, lockedItemMessage, lockedChargeMessage } from '@/lib/itemLock';

describe('isItemLocked', () => {
  // The rule is "attached to an invoice", not "attached to a *live* invoice" —
  // an item on a draft or even a voided invoice is still locked, because the
  // lock is derived from invoiceId alone.
  it('locks an item the moment it has an invoiceId', () => {
    expect(isItemLocked({ invoiceId: 'inv-1' })).toBe(true);
  });

  it('leaves an unattached item editable', () => {
    expect(isItemLocked({ invoiceId: null })).toBe(false);
  });

  // An empty string is a real id in no sense, but it is not null — pinning the
  // exact predicate so a future `!item.invoiceId` rewrite is a visible change.
  it('treats any non-null invoiceId as locked', () => {
    expect(isItemLocked({ invoiceId: '' })).toBe(true);
  });
});

describe('lock messages', () => {
  it('names the invoice so the user knows where to go', () => {
    expect(lockedItemMessage('MDI-004')).toContain('MDI-004');
    expect(lockedChargeMessage('MDI-DF-002')).toContain('MDI-DF-002');
  });

  it('distinguishes an item from a design fee charge', () => {
    expect(lockedItemMessage('X')).toMatch(/item/i);
    expect(lockedChargeMessage('X')).toMatch(/charge/i);
  });
});
