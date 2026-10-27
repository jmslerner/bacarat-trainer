/**
 * Table keyboard shortcuts: 1–6 select a chip, P/B/T place on Player/Banker/Tie, D Dragon 7, N Panda 8,
 * Space deal (or fast-forward the dealing), R rebet, C clear, U undo, A auto-deal.
 *
 * Ignored while typing in a field, with modifier keys, and while a modal dialog is open.
 *
 * Space always deals (SPEC §5.5) — including when a spot or a chip was just clicked with the mouse and still
 * holds focus. The one exception is a control reached with the keyboard (Tab / arrow keys): there Space keeps
 * its native activation so keyboard users can still press a focused spot, toggle or panel header. Enter
 * activates a focused control in either case. (Browsers flip `:focus-visible` on the first keydown, so the
 * modality is tracked here instead.)
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

export type FocusModality = 'pointer' | 'keyboard';

/** How focus last moved: by a pointer (click / tap) or by the keyboard (Tab, arrows). */
let modality: FocusModality = 'pointer';
const NAVIGATION_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

/** The focus modality seen by the shortcuts (exported for tests). */
export function focusModality(): FocusModality {
  return modality;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Buttons and links handle Space/Enter themselves. */
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
    const onPointerDown = (): void => {
      modality = 'pointer';
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (NAVIGATION_KEYS.has(e.key)) modality = 'keyboard';
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target) || isModalOpen()) return;
      const action = shortcutFor(e.key);
      if (!action) return;
      // Space on a control the user reached with the keyboard activates that control (its native behaviour).
      if (action.type === 'deal' && modality === 'keyboard' && isActivatableTarget(e.target)) return;
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
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
