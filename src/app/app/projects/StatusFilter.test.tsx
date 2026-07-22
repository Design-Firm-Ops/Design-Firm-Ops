import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, createRouterMock } from '@/test';
import StatusFilter from './StatusFilter';

// StatusFilter navigates via next/navigation's router; mock it so we can
// assert on where it pushes without a real Next runtime.
const router = createRouterMock();
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  router.push.mockClear();
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
