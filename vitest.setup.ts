// Setup for the jsdom (component) test project.
// - Adds jest-dom matchers (toBeInTheDocument, toBeDisabled, ...).
// - Unmounts rendered React trees between tests so they don't leak.
// - Restores any global stubs (e.g. mockFetch) after each test.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
