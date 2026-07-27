import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, mockNextNavigation, nextNavigationMock } from '@/test';
import LoginPage from './page';

// Signing in has to land you somewhere you're allowed to be.
//
// It didn't, before DES-26: everyone was sent to /app/projects, so a
// super-admin was bounced off the route gate and returned to this form —
// signed in, with nowhere to go.

vi.mock('next/navigation', () => nextNavigationMock);

const signIn = vi.fn();
const getSession = vi.fn();
vi.mock('next-auth/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-auth/react')>()),
  signIn: (...args: unknown[]) => signIn(...args),
  getSession: () => getSession(),
}));

let router: ReturnType<typeof mockNextNavigation>;

beforeEach(() => {
  router = mockNextNavigation({ pathname: '/login' });
  signIn.mockReset().mockResolvedValue({ error: null });
  getSession.mockReset().mockResolvedValue({ user: { role: 'ADMIN' } });
});

async function submit(email = 'someone@example.test') {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), 'correct horse');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage', () => {
  it('sends a firm user to their projects', async () => {
    renderWithProviders(<LoginPage />);
    await submit();
    expect(router.push).toHaveBeenCalledWith('/app/projects');
  });

  it('sends the platform operator to the console', async () => {
    getSession.mockResolvedValue({ user: { role: 'SUPER_ADMIN' } });
    renderWithProviders(<LoginPage />);
    await submit('operator@example.test');
    expect(router.push).toHaveBeenCalledWith('/admin');
  });

  it('reports a rejected sign-in without navigating', async () => {
    signIn.mockResolvedValue({ error: 'CredentialsSignin' });
    renderWithProviders(<LoginPage />);
    await submit();

    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  // The button must come back so a mistyped password can be retried.
  it('re-enables the form after a failure', async () => {
    signIn.mockResolvedValue({ error: 'CredentialsSignin' });
    renderWithProviders(<LoginPage />);
    await submit();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });
});
