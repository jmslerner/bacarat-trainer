/**
 * Table keyboard shortcuts: 1–6 select a chip, P/B/T place on Player/Banker/Tie, D Dragon 7, N Panda 8,
 * Space deal (or fast-forward the dealing), R rebet, C clear, U undo, A auto-deal.
 *
 * Ignored while typing in a field, with modifier keys, and while a modal dialog is open.
 */
import { useEffect, useRef } from 'react';
import type { BetType } from '@/engine';

export interface ShortcutHandlers {
  selectChip: (index: number) => void;
  place: (bet: BetType) => void;
  deal: () => void;
  rebet: () => void;
  clear: () => void;
  undo: () => void;
  toggleAuto: () => void;
}

const BET_KEYS: Readonly<Record<string, BetType>> = { p: 'player', b: 'banker', t: 'tie', d: 'dragon7', n: 'panda8' };

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Buttons and links handle Space/Enter themselves (a spot or chip reached with Tab must stay activatable). */
export function isActivatableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || target.getAttribute('role') === 'button';
}

export function isModalOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/** Maps a key to the shortcut action, or null. Exported for tests. */
export function shortcutFor(key: string): { type: 'chip'; index: number } | { type: 'bet'; bet: BetType } | { type: 'deal' | 'rebet' | 'clear' | 'undo' | 'auto' } | null {
  if (/^[1-6]$/.test(key)) return { type: 'chip', index: Number(key) - 1 };
  const k = key.toLowerCase();
  if (k in BET_KEYS) return { type: 'bet', bet: BET_KEYS[k] };
  if (k === ' ' || k === 'spacebar') return { type: 'deal' };
  if (k === 'r') return { type: 'rebet' };
  if (k === 'c') return { type: 'clear' };
  if (k === 'u') return { type: 'undo' };
  if (k === 'a') return { type: 'auto' };
  return null;
}

export function useShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target) || isModalOpen()) return;
      const action = shortcutFor(e.key);
      if (!action) return;
      if (action.type === 'deal' && isActivatableTarget(e.target)) return; // Space activates the focused control
      if (e.repeat && action.type !== 'bet') return;
      e.preventDefault();
      const h = ref.current;
      switch (action.type) {
        case 'chip':
          h.selectChip(action.index);
          break;
        case 'bet':
          h.place(action.bet);
          break;
        case 'deal':
          h.deal();
          break;
        case 'rebet':
          h.rebet();
          break;
        case 'clear':
          h.clear();
          break;
        case 'undo':
          h.undo();
          break;
        case 'auto':
          h.toggleAuto();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
