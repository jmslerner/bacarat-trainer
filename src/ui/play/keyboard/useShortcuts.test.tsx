// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { focusModality, shortcutFor, useShortcuts, type ShortcutHandlers } from './useShortcuts';

afterEach(() => {
  cleanup();
  document.querySelectorAll('[role="dialog"]').forEach((d) => d.remove());
});

function handlers(): ShortcutHandlers & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    selectChip: (i) => calls.push(`chip:${i}`),
    place: (bet) => calls.push(`place:${bet}`),
    deal: () => calls.push('deal'),
    rebet: () => calls.push('rebet'),
    clear: () => calls.push('clear'),
    undo: () => calls.push('undo'),
    toggleAuto: () => calls.push('auto'),
  };
}

function Harness({ h, enabled = true }: { h: ShortcutHandlers; enabled?: boolean }) {
  useShortcuts(h, enabled);
  return (
    <div>
      <input aria-label="field" />
    </div>
  );
}

describe('shortcutFor', () => {
  it('maps the documented keys', () => {
    expect(shortcutFor('1')).toEqual({ type: 'chip', index: 0 });
    expect(shortcutFor('6')).toEqual({ type: 'chip', index: 5 });
    expect(shortcutFor('9')).toEqual({ type: 'chip', index: 8 });
    expect(shortcutFor('0')).toBeNull();
    expect(shortcutFor('p')).toEqual({ type: 'bet', bet: 'player' });
    expect(shortcutFor('B')).toEqual({ type: 'bet', bet: 'banker' });
    expect(shortcutFor('t')).toEqual({ type: 'bet', bet: 'tie' });
    expect(shortcutFor('d')).toEqual({ type: 'bet', bet: 'dragon7' });
    expect(shortcutFor('n')).toEqual({ type: 'bet', bet: 'panda8' });
    expect(shortcutFor(' ')).toEqual({ type: 'deal' });
    expect(shortcutFor('r')).toEqual({ type: 'rebet' });
    expect(shortcutFor('c')).toEqual({ type: 'clear' });
    expect(shortcutFor('u')).toEqual({ type: 'undo' });
    expect(shortcutFor('a')).toEqual({ type: 'auto' });
    expect(shortcutFor('x')).toBeNull();
  });
});

describe('useShortcuts', () => {
  it('dispatches on window keydown and ignores modifiers, fields, repeats and dialogs', () => {
    const h = handlers();
    const { getByLabelText } = render(<Harness h={h} />);
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'u' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(h.calls).toEqual(['chip:1', 'place:banker', 'deal', 'rebet', 'clear', 'undo', 'auto']);

    h.calls.length = 0;
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'b', metaKey: true });
    fireEvent.keyDown(window, { key: ' ', repeat: true });
    fireEvent.keyDown(getByLabelText('field'), { key: 'b' });
    expect(h.calls).toEqual([]);

    // held-down bet keys repeat (placing several chips), the deal key does not
    fireEvent.keyDown(window, { key: 'p', repeat: true });
    expect(h.calls).toEqual(['place:player']);

    // Space on a button that was clicked (pointer focus) still deals — a spot or chip under the mouse must not
    // swallow the deal key; after Tab (keyboard focus) Space is left to the button's native activation.
    const button = document.createElement('button');
    document.body.appendChild(button);
    fireEvent.pointerDown(button);
    expect(focusModality()).toBe('pointer');
    expect(fireEvent.keyDown(button, { key: ' ' })).toBe(false);
    expect(h.calls).toEqual(['place:player', 'deal']);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(focusModality()).toBe('keyboard');
    expect(fireEvent.keyDown(button, { key: ' ' })).toBe(true);
    fireEvent.keyDown(button, { key: 'r' });
    expect(h.calls).toEqual(['place:player', 'deal', 'rebet']);
    fireEvent.keyDown(window, { key: ' ' }); // nothing focused: deals regardless of modality
    expect(h.calls).toEqual(['place:player', 'deal', 'rebet', 'deal']);
    fireEvent.pointerDown(button);
    expect(focusModality()).toBe('pointer');
    button.remove();
    h.calls.length = 0;
    h.calls.push('place:player', 'rebet');

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: 'b' });
    expect(h.calls).toEqual(['place:player', 'rebet']);
    dialog.remove();
  });

  it('can be disabled and prevents the default action of handled keys', () => {
    const h = handlers();
    const { rerender } = render(<Harness h={h} enabled={false} />);
    fireEvent.keyDown(window, { key: 'b' });
    expect(h.calls).toEqual([]);
    rerender(<Harness h={h} enabled />);
    const prevented = !fireEvent.keyDown(window, { key: ' ' });
    expect(prevented).toBe(true);
    const untouched = fireEvent.keyDown(window, { key: 'z' });
    expect(untouched).toBe(true);
    expect(h.calls).toEqual(['deal']);
    vi.restoreAllMocks();
  });
});
