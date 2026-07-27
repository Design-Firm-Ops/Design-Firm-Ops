import { describe, it, expect, vi, beforeEach } from 'vitest';
import { within } from '@testing-library/react';
import { renderWithProviders, screen, userEvent, mockNextNavigation, nextNavigationMock, mockFetch } from '@/test';
import UsersManager from './UsersManager';

vi.mock('next/navigation', () => nextNavigationMock);

const ME = { id: 'me', name: 'Sam Reyes', email: 'sam@firm.test', role: 'ADMIN', active: true, createdAt: '' };
const COLLEAGUE = { id: 'u2', name: 'Alex Chen', email: 'alex@firm.test', role: 'ADMIN', active: true, createdAt: '' };
const DEACTIVATED = { id: 'u3', name: 'Jo Park', email: 'jo@firm.test', role: 'DESIGNER', active: false, createdAt: '' };

beforeEach(() => {
  mockNextNavigation({ pathname: '/app/settings' });
  mockFetch({ ok: true });
});

const rowFor = (name: string) => within(screen.getByText(name, { exact: false }).closest('tr')!);

const render = () =>
  renderWithProviders(<UsersManager initialUsers={[ME, COLLEAGUE, DEACTIVATED]} currentUserId="me" />);

describe('UsersManager', () => {
  // The reported footgun: deactivation blocks sign-in, so doing it to yourself
  // is a lockout only another administrator can undo.
  it('does not offer to deactivate you', () => {
    render();
    expect(rowFor('Sam Reyes').queryByRole('button', { name: /deactivate/i })).toBeNull();
  });

  it('still offers it for everyone else', () => {
    render();
    expect(rowFor('Alex Chen').getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(rowFor('Jo Park').getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  // The row is still yours to edit — only deactivation is withheld.
  it('leaves your own account editable', () => {
    render();
    expect(rowFor('Sam Reyes').getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('marks which row is you, so the missing control reads as deliberate', () => {
    render();
    expect(rowFor('Sam Reyes').getByText('(you)')).toBeInTheDocument();
  });

  it('confirms before deactivating a teammate', async () => {
    const fetchMock = mockFetch({ ok: true });
    render();

    await userEvent.click(rowFor('Alex Chen').getByRole('button', { name: 'Deactivate' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
