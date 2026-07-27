import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, mockNextNavigation, nextNavigationMock } from '@/test';
import AdminNav from './AdminNav';

vi.mock('next/navigation', () => nextNavigationMock);

beforeEach(() => {
  mockNextNavigation({ pathname: '/admin/firms' });
});

const signOut = vi.fn();
vi.mock('next-auth/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-auth/react')>()),
  signOut: (...args: unknown[]) => signOut(...args),
}));

describe('AdminNav', () => {
  it('links to the console sections', () => {
    renderWithProviders(<AdminNav userName="Operator" />);
    expect(screen.getByRole('link', { name: 'Firms' })).toHaveAttribute('href', '/admin/firms');
  });

  // An operator must be able to tell which side of the tenancy line they are
  // on without reading the URL.
  it('identifies itself as the platform console', () => {
    renderWithProviders(<AdminNav userName="Operator" />);
    expect(screen.getByText('Platform Console')).toBeInTheDocument();
  });

  // The console is for a user who cannot load /app at all — a link there would
  // be a dead end through middleware.
  it('does not link into the firm-facing app', () => {
    renderWithProviders(<AdminNav userName="Operator" />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^\/app(\/|$)/);
    }
  });

  it('shows the signed-in operator', () => {
    renderWithProviders(<AdminNav userName="Operator" />);
    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  it('signs out to the login page', async () => {
    renderWithProviders(<AdminNav userName="Operator" />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });
});
