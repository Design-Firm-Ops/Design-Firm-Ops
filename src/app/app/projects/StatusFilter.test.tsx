import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, mockNextNavigation, nextNavigationMock, type RouterMock } from '@/test';
import StatusFilter from './StatusFilter';

// StatusFilter navigates via next/navigation's router; mock it so we can
// assert on where it pushes without a real Next runtime.
vi.mock('next/navigation', () => nextNavigationMock);

let router: RouterMock;
beforeEach(() => {
  router = mockNextNavigation({ pathname: '/app/projects' });
});

describe('StatusFilter', () => {
  it('renders the current value as selected', () => {
    render(<StatusFilter value="ACTIVE" />);
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('ACTIVE');
  });

  it('offers all status options', () => {
    render(<StatusFilter value="ACTIVE" />);
    for (const label of ['Active', 'Lead', 'On Hold', 'Complete', 'All Statuses']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('navigates to the chosen status on change', async () => {
    render(<StatusFilter value="ACTIVE" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'COMPLETE');
    expect(router.push).toHaveBeenCalledWith('/app/projects?status=COMPLETE');
  });
});
