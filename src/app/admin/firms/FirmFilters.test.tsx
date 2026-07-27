import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, mockNextNavigation, nextNavigationMock } from '@/test';
import FirmFilters from './FirmFilters';
import { NO_FIRM_FILTERS } from '@/lib/firms';

vi.mock('next/navigation', () => nextNavigationMock);

let router: ReturnType<typeof mockNextNavigation>;
beforeEach(() => {
  router = mockNextNavigation({ pathname: '/admin/firms' });
});

describe('FirmFilters', () => {
  it('shows the filters the list was built from', () => {
    renderWithProviders(<FirmFilters filters={{ search: 'west', status: 'SUSPENDED' }} />);
    expect(screen.getByRole('searchbox', { name: /search firms/i })).toHaveValue('west');
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveValue('SUSPENDED');
  });

  it('searches on submit', async () => {
    renderWithProviders(<FirmFilters filters={NO_FIRM_FILTERS} />);
    await userEvent.type(screen.getByRole('searchbox', { name: /search firms/i }), 'westland{Enter}');
    expect(router.push).toHaveBeenCalledWith('/admin/firms?q=westland');
  });

  it('filters by status immediately', async () => {
    renderWithProviders(<FirmFilters filters={NO_FIRM_FILTERS} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /status/i }), 'SUSPENDED');
    expect(router.push).toHaveBeenCalledWith('/admin/firms?status=SUSPENDED');
  });

  // Each control must carry the other's value, or using one silently resets
  // the other — the most common way a two-filter list misleads someone.
  it('keeps the status when searching', async () => {
    renderWithProviders(<FirmFilters filters={{ search: '', status: 'ACTIVE' }} />);
    await userEvent.type(screen.getByRole('searchbox', { name: /search firms/i }), 'west{Enter}');
    expect(router.push).toHaveBeenCalledWith('/admin/firms?q=west&status=ACTIVE');
  });

  it('keeps the search when changing status', async () => {
    renderWithProviders(<FirmFilters filters={{ search: 'west', status: 'ALL' }} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /status/i }), 'TRIAL');
    expect(router.push).toHaveBeenCalledWith('/admin/firms?q=west&status=TRIAL');
  });

  it('clearing the box returns to the unfiltered list', async () => {
    renderWithProviders(<FirmFilters filters={{ search: 'west', status: 'ALL' }} />);
    await userEvent.clear(screen.getByRole('searchbox', { name: /search firms/i }));
    await userEvent.type(screen.getByRole('searchbox', { name: /search firms/i }), '{Enter}');
    expect(router.push).toHaveBeenCalledWith('/admin/firms');
  });

  it('offers every status plus "all"', () => {
    renderWithProviders(<FirmFilters filters={NO_FIRM_FILTERS} />);
    const options = screen.getAllByRole('option').map((o) => o.getAttribute('value'));
    expect(options).toEqual(['ALL', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELED']);
  });
});
