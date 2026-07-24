import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, userEvent, mockNextNavigation, nextNavigationMock, mockFetch, type RouterMock } from '@/test';
import NavSearch from './NavSearch';

vi.mock('next/navigation', () => nextNavigationMock);

let router: RouterMock;
beforeEach(() => {
  router = mockNextNavigation();
});

describe('NavSearch', () => {
  it('queries the search API and shows results as you type', async () => {
    mockFetch({
      results: [{ type: 'project', label: 'Red Rock Office', sublabel: 'Westland Reserve', href: '/app/projects/1' }],
    });

    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'red');

    expect(await screen.findByText('Red Rock Office')).toBeInTheDocument();
    expect(screen.getByText('Westland Reserve')).toBeInTheDocument();
  });

  it('navigates to a result when clicked', async () => {
    mockFetch({ results: [{ type: 'project', label: 'Red Rock Office', href: '/app/projects/1' }] });

    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'red');
    await userEvent.click(await screen.findByText('Red Rock Office'));

    expect(router.push).toHaveBeenCalledWith('/app/projects/1');
  });

  it('shows an empty state when the API returns no matches', async () => {
    mockFetch({ results: [] });

    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'zzz');

    await waitFor(() => expect(screen.getByText('No matches.')).toBeInTheDocument());
  });
});

describe('NavSearch — keyboard and dismissal', () => {
  const results = [
    { type: 'project', label: 'Alpha', href: '/app/projects/a' },
    { type: 'project', label: 'Beta', href: '/app/projects/b' },
    { type: 'vendor', label: 'Gamma', href: '/app/vendors/g' },
  ];

  async function openWithResults() {
    mockFetch({ results });
    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'a');
    await screen.findByText('Alpha');
  }

  it('moves the selection down and opens the highlighted result on Enter', async () => {
    await openWithResults();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(router.push).toHaveBeenCalledWith('/app/projects/b');
  });

  it('does not move past the last result', async () => {
    await openWithResults();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(router.push).toHaveBeenCalledWith('/app/vendors/g');
  });

  it('does not move above the first result', async () => {
    await openWithResults();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{Enter}');
    expect(router.push).toHaveBeenCalledWith('/app/projects/a');
  });

  it('closes on Escape without navigating', async () => {
    await openWithResults();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('closes when clicking outside the search box', async () => {
    await openWithResults();
    await userEvent.click(document.body);
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('ignores arrow keys when there are no results', async () => {
    mockFetch({ results: [] });
    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'zzz');
    await waitFor(() => expect(screen.getByText('No matches.')).toBeInTheDocument());

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('recovers from a failed search request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'x');
    // No crash, no results, and the loading state clears.
    await waitFor(() => expect(screen.queryByText('Searching…')).not.toBeInTheDocument());
  });

  it('treats a non-ok response as no results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response));
    render(<NavSearch />);
    await userEvent.type(screen.getByPlaceholderText('Search anything…'), 'x');
    await waitFor(() => expect(screen.getByText('No matches.')).toBeInTheDocument());
  });
});
