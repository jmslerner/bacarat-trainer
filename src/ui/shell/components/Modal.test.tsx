// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Modal } from './Modal';

afterEach(cleanup);

describe('Modal', () => {
  it('renders a labelled modal dialog in a portal and closes on Escape, the backdrop and the close button', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Table Settings" description="Rules and bankroll">
        <input aria-label="inside" />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Table Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Rules and bankroll');
    expect(screen.getByTestId('modal-backdrop').parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(dialog); // inside the frame: not a backdrop click
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('honours closeOnEscape / closeOnBackdrop = false', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Locked" closeOnEscape={false} closeOnBackdrop={false}>
        <p>body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the opener and unlocks scrolling when closed', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(
      <Modal open onClose={() => undefined} title="T">
        <p>body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} onClose={() => undefined} title="T">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
