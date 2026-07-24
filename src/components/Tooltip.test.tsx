import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
  it('renders the reason alongside the control', () => {
    render(
      <Tooltip reason="This item is locked to invoice MDI-004.">
        <button disabled>Edit</button>
      </Tooltip>
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('This item is locked to invoice MDI-004.')).toBeInTheDocument();
  });

  // The wrapper exists only to explain *why* something is unavailable, so with
  // no reason it must add no markup at all.
  it('renders children unchanged when there is no reason', () => {
    const { container } = render(
      <Tooltip reason={null}>
        <button>Edit</button>
      </Tooltip>
    );
    expect(container.innerHTML).toBe('<button>Edit</button>');
  });

  it('treats an empty reason as no reason', () => {
    const { container } = render(
      <Tooltip reason="">
        <button>Edit</button>
      </Tooltip>
    );
    expect(container.innerHTML).toBe('<button>Edit</button>');
  });

  it('does not intercept pointer events over the control', () => {
    render(
      <Tooltip reason="why">
        <button>Edit</button>
      </Tooltip>
    );
    expect(screen.getByText('why').className).toContain('pointer-events-none');
  });
});
