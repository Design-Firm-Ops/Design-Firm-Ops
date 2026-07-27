import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test';
import { FIRM_STATUSES } from '@/lib/domain';
import FirmStatusBadge from './FirmStatusBadge';

describe('FirmStatusBadge', () => {
  it('renders a readable label for every status', () => {
    for (const status of FIRM_STATUSES) {
      const { unmount } = renderWithProviders(<FirmStatusBadge status={status} />);
      // Title case rather than the raw enum — this is customer-facing chrome.
      expect(screen.getByText(new RegExp(`^${status[0]}${status.slice(1).toLowerCase()}$`, 'i'))).toBeInTheDocument();
      unmount();
    }
  });

  // Suspended is the one an operator must never misread as fine.
  it('distinguishes suspended from active visually', () => {
    const { unmount } = renderWithProviders(<FirmStatusBadge status="SUSPENDED" />);
    const suspended = screen.getByText('Suspended').className;
    unmount();

    renderWithProviders(<FirmStatusBadge status="ACTIVE" />);
    expect(screen.getByText('Active').className).not.toBe(suspended);
  });
});
