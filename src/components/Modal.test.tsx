import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test';
import Modal from './Modal';

describe('Modal', () => {
  it('renders its children in a dialog when open', () => {
    render(
      <Modal>
        <p>Body copy</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Body copy')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false}>
        <p>Body copy</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>Body copy</p>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a click of the backdrop but not the panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>Body copy</p>
      </Modal>
    );

    await userEvent.click(screen.getByText('Body copy'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when no handler is given', async () => {
    render(
      <Modal>
        <p>Body copy</p>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('applies the requested width and elevation', () => {
    const { rerender } = render(
      <Modal width="2xl">
        <p>x</p>
      </Modal>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-2xl');
    expect(screen.getByRole('dialog').parentElement!.className).toContain('z-40');

    rerender(
      <Modal width="sm" elevated>
        <p>x</p>
      </Modal>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-sm');
    expect(screen.getByRole('dialog').parentElement!.className).toContain('z-50');
  });

  it('renders the panel as a form and submits it', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <Modal onSubmit={onSubmit}>
        <button type="submit">Save</button>
      </Modal>
    );

    expect(screen.getByRole('dialog').tagName).toBe('FORM');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('locks background scroll while open and restores it on close', () => {
    const { rerender } = render(
      <Modal>
        <p>x</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false}>
        <p>x</p>
      </Modal>
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
