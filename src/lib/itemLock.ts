/**
 * An item (or design fee charge — same pattern, see
 * DesignFeeCharge.invoiceId) is locked the moment it's attached to an
 * invoice, independent of that invoice's status. Deliberately not a
 * stored column: it's derived from invoiceId, so it can never drift out
 * of sync with the actual relationship.
 */
export function isItemLocked(item: { invoiceId: string | null }): boolean {
  return item.invoiceId !== null;
}

export function lockedItemMessage(invoiceNumber: string): string {
  return `This item is locked to invoice ${invoiceNumber}. Unlock to edit.`;
}

export function lockedChargeMessage(invoiceNumber: string): string {
  return `This charge is locked to invoice ${invoiceNumber}. Unlock to edit.`;
}
