import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '@/test';
import Tabs from './Tabs';

const tabs = [
  { key: 'info', label: 'Contact', content: <p>contact panel</p> },
  { key: 'items', label: 'Linked Items', content: <p>items panel</p> },
  { key: 'docs', label: 'Documents', content: <p>docs panel</p> },
];

describe('Tabs', () => {
  it('shows the first tab by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByText('contact panel')).toBeInTheDocument();
    expect(screen.queryByText('items panel')).not.toBeInTheDocument();
  });

  it('switches panels when another tab is clicked', async () => {
    render(<Tabs tabs={tabs} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Linked Items' }));

    expect(screen.getByText('items panel')).toBeInTheDocument();
    expect(screen.queryByText('contact panel')).not.toBeInTheDocument();
  });

  it('marks exactly one tab selected for assistive tech', async () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Contact' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Contact' })).toHaveAttribute('aria-selected', 'false');
  });

  // Permission gating works by omitting tabs, not disabling them — so a hidden
  // tab must leave no trace a user could reach.
  it('renders only the tabs it is given', () => {
    render(<Tabs tabs={tabs.slice(0, 1)} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.queryByText('Linked Items')).not.toBeInTheDocument();
  });

  it('shows an empty state when every tab is gated away', () => {
    render(<Tabs tabs={[]} />);
    expect(screen.getByText('No tabs are visible to your role.')).toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('accepts a caller-supplied empty message', () => {
    render(<Tabs tabs={[]} emptyMessage="Nothing to show here." />);
    expect(screen.getByText('Nothing to show here.')).toBeInTheDocument();
  });

  it('renders an action alongside the tab strip', () => {
    render(<Tabs tabs={tabs} action={<a href="/back">← All Vendors</a>} />);
    expect(screen.getByRole('link', { name: '← All Vendors' })).toBeInTheDocument();
  });

  it('survives a tab list that changes underneath it', () => {
    const { rerender } = render(<Tabs tabs={tabs} />);
    // The previously-active key is gone; it should fall back rather than blank.
    rerender(<Tabs tabs={tabs.slice(1)} />);
    expect(screen.getByText('items panel')).toBeInTheDocument();
  });
});
