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
