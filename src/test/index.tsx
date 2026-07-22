// The one import a component test needs:
//   import { renderWithProviders, screen, userEvent, fakeSession } from '@/test';
import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { fakeSession } from './mocks';
import type { Session } from 'next-auth';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** The session context. Pass `null` to render as signed-out. */
  session?: Session | null;
}

/**
 * Renders `ui` inside the app's client providers (currently
 * SessionProvider) so components that call `useSession` work without each
 * test wiring up context. Everything else mirrors RTL's `render`.
 */
export function renderWithProviders(ui: ReactElement, { session = fakeSession(), ...options }: Options = {}) {
  return render(<SessionProvider session={session}>{ui}</SessionProvider>, options);
}

// Re-export the testing toolkit so tests have a single import site.
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export * from './mocks';
