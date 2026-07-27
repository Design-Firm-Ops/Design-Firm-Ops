import { describe, it, expect, vi, beforeEach } from 'vitest';
import { within } from '@testing-library/react';
import { renderWithProviders, screen, userEvent, mockNextNavigation, nextNavigationMock, mockFetch } from '@/test';
import FirmActions from './FirmActions';

vi.mock('next/navigation', () => nextNavigationMock);

let router: ReturnType<typeof mockNextNavigation>;
beforeEach(() => {
  router = mockNextNavigation({ pathname: '/admin/firms/f1' });
});

const render = (status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELED' = 'ACTIVE') =>
  renderWithProviders(<FirmActions firmId="f1" firmName="Westland Reserve" status={status} />);

describe('FirmActions', () => {
  it('offers only the moves that are legal from here', () => {
    render('ACTIVE');
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // ACTIVE cannot become ACTIVE, and nothing returns to TRIAL.
    expect(screen.queryByRole('button', { name: /^(re)?activate$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /trial/i })).toBeNull();
  });

  it('offers reactivation for a suspended firm, and nothing else destructive', () => {
    render('SUSPENDED');
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
  });

  it('offers only reactivation for a canceled firm', () => {
    render('CANCELED');
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  // The house rule: nothing that cuts a firm off fires straight from a click.
  it('confirms before suspending, naming the firm and the consequence', async () => {
    const fetchMock = mockFetch({ ok: true });
    render('ACTIVE');

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(screen.getByText(/suspend westland reserve\?/i)).toBeInTheDocument();
    expect(screen.getByText(/no data is deleted/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Two buttons meaning opposite things must not share a name. Confirming the
  // cancel *action* inside a dialog whose dismiss button is already "Cancel"
  // is how an operator ends the wrong thing — so the confirm reads "Cancel firm".
  it('distinguishes dismissing the dialog from cancelling the firm', async () => {
    mockFetch({ ok: true });
    render('ACTIVE');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Cancel firm' })).toBeInTheDocument();
    expect(dialog.getAllByRole('button', { name: /cancel/i }).map((b) => b.textContent)).toEqual([
      'Cancel',
      'Cancel firm',
    ]);
  });

  it('sends the change once confirmed, then refreshes', async () => {
    const fetchMock = mockFetch({ ok: true });
    render('ACTIVE');

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend firm' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/firms/f1/status',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'SUSPENDED' }) })
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('does nothing when the confirmation is dismissed', async () => {
    const fetchMock = mockFetch({ ok: true });
    render('ACTIVE');

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  // A refused change must never look like a successful one.
  it('surfaces a refusal from the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ error: 'A canceled firm cannot become suspended.' }) }))
    );
    render('ACTIVE');

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend firm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot become suspended/i);
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
