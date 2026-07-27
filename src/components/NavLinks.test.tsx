import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, mockNextNavigation, nextNavigationMock } from '@/test';
import NavLinks from './NavLinks';

vi.mock('next/navigation', () => nextNavigationMock);

const LINKS = [
  { href: '/admin/firms', label: 'Firms' },
  { href: '/admin/metrics', label: 'Metrics' },
];

/** The active link is the one styled as current — asserted via aria, not classes. */
const current = () => screen.queryByRole('link', { current: 'page' });

describe('NavLinks', () => {
  beforeEach(() => mockNextNavigation({ pathname: '/admin/firms' }));

  it('renders a link per entry', () => {
    renderWithProviders(<NavLinks links={LINKS} />);
    expect(screen.getByRole('link', { name: 'Firms' })).toHaveAttribute('href', '/admin/firms');
    expect(screen.getByRole('link', { name: 'Metrics' })).toHaveAttribute('href', '/admin/metrics');
  });

  it('marks the current section', () => {
    renderWithProviders(<NavLinks links={LINKS} />);
    expect(current()).toHaveAccessibleName('Firms');
  });

  // A detail page is still "in" its section, which is why this matches on
  // prefix rather than equality.
  it('keeps the section marked on a child route', () => {
    mockNextNavigation({ pathname: '/admin/firms/firm-a' });
    renderWithProviders(<NavLinks links={LINKS} />);
    expect(current()).toHaveAccessibleName('Firms');
  });

  // The reason this is prefix-matching on a path segment rather than a bare
  // startsWith: '/admin/firms-archive' is a different section.
  it('does not mark a section whose href is merely a string prefix', () => {
    mockNextNavigation({ pathname: '/admin/firms-archive' });
    renderWithProviders(<NavLinks links={LINKS} />);
    expect(current()).toBeNull();
  });

  it('marks nothing when the route is outside every section', () => {
    mockNextNavigation({ pathname: '/admin' });
    renderWithProviders(<NavLinks links={LINKS} />);
    expect(current()).toBeNull();
  });
});
