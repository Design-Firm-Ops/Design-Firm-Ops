import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, mockNextNavigation, nextNavigationMock } from '@/test';
import SignupForm from './SignupForm';

vi.mock('next/navigation', () => nextNavigationMock);

const signIn = vi.fn();
vi.mock('next-auth/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-auth/react')>()),
  signIn: (...args: unknown[]) => signIn(...args),
}));

let router: ReturnType<typeof mockNextNavigation>;
let fetchMock: ReturnType<typeof vi.fn>;

function stubSignup(response: { ok: boolean; body?: unknown }) {
  fetchMock = vi.fn(async () => ({
    ok: response.ok,
    json: async () => response.body ?? { firmId: 'f1', slug: 'harbor-pine' },
  }));
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  router = mockNextNavigation({ pathname: '/signup' });
  signIn.mockReset().mockResolvedValue({ error: null });
  stubSignup({ ok: true });
});

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Firm name'), 'Harbor & Pine');
  await userEvent.type(screen.getByLabelText('Your name'), 'Sam Reyes');
  await userEvent.type(screen.getByLabelText('Email'), 'sam@harbor.test');
  await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
  await userEvent.click(screen.getByRole('button', { name: /create firm/i }));
}

describe('SignupForm', () => {
  // Every firm starts on a free trial, so there is no price to choose before
  // seeing the product — and nothing here should ask for one.
  it('does not ask anyone to pick a plan', () => {
    renderWithProviders(<SignupForm />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });

  it('sends the whole form', async () => {
    renderWithProviders(<SignupForm />);
    await fillAndSubmit();

    expect(fetchMock).toHaveBeenCalledWith('/api/signup', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      firmName: 'Harbor & Pine',
      adminName: 'Sam Reyes',
      email: 'sam@harbor.test',
      password: 'correct horse battery',
    });
  });

  // One path mints a session — the one with DES-27's firm-status gate on it.
  it('signs in with the credentials just set, then goes straight to the app', async () => {
    renderWithProviders(<SignupForm />);
    await fillAndSubmit();

    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'sam@harbor.test',
      password: 'correct horse battery',
      redirect: false,
    });
    // No billing step in between — a trial needs no payment decision.
    expect(router.push).toHaveBeenCalledWith('/app/projects');
  });

  it('reports a taken email without navigating', async () => {
    stubSignup({ ok: false, body: { error: 'That email address is already registered.' } });
    renderWithProviders(<SignupForm />);
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/already registered/i);
    expect(signIn).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  // Zod returns a structured error object, which must not be rendered as
  // "[object Object]" at the user.
  it('falls back to a readable message for a structured validation error', async () => {
    stubSignup({ ok: false, body: { error: { fieldErrors: { password: ['too short'] } } } });
    renderWithProviders(<SignupForm />);
    await fillAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/object Object/);
    expect(alert).toHaveTextContent(/check the form/i);
  });

  // The firm does exist at this point — saying "sign-up failed" would send
  // someone off to register a second time.
  it('does not claim the firm failed when only the sign-in did', async () => {
    signIn.mockResolvedValue({ error: 'CredentialsSignin' });
    renderWithProviders(<SignupForm />);
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/firm was created/i);
  });

  it('re-enables the button after a failure so it can be retried', async () => {
    stubSignup({ ok: false, body: { error: 'Nope' } });
    renderWithProviders(<SignupForm />);
    await fillAndSubmit();

    expect(screen.getByRole('button', { name: /create firm/i })).toBeEnabled();
  });
});
