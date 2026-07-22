import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test';
import Nav from './Nav';

// Nav reads the active route and signs out; mock both boundaries.
vi.mock('next/navigation', () => ({ usePathname: () => '/app/vendors' }));

const signOut = vi.fn();
vi.mock('next-auth/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-auth/react')>()),
  signOut: (...args: unknown[]) => signOut(...args),
}));

describe('Nav', () => {
  it('renders the primary navigation links', () => {
    renderWithProviders(<Nav userName="Madison" />);
    for (const label of ['Projects', 'Business Development', 'Vendors', 'Administration', 'Settings']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('shows the signed-in user name', () => {
    renderWithProviders(<Nav userName="Madison" />);
    expect(screen.getByText('Madison')).toBeInTheDocument();
  });

  it('signs out to the login page', async () => {
    renderWithProviders(<Nav userName="Madison" />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });
});
