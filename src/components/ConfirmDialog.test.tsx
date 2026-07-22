import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '@/components/ConfirmDialog';

const baseProps = {
  open: true,
  title: 'Delete client',
  message: 'This cannot be undone.',
  onConfirm: () => {},
  onCancel: () => {},
};

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the title and message when open', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Delete client')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('uses the default confirm label and a custom one', () => {
    const { rerender } = render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    rerender(<ConfirmDialog {...baseProps} confirmLabel="Remove" />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('fires onConfirm and onCancel from the buttons', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows a working label and disables both buttons while busy', () => {
    render(<ConfirmDialog {...baseProps} busy />);
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
