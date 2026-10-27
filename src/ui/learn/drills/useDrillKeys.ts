/**
 * Window-level keyboard shortcuts for a drill (Y/N, 1–4, R/B, Enter …). Ignored while typing in a field,
 * when a modifier is held, and when another handler already consumed the event.
 */
import { useEffect, useRef } from 'react';

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export type DrillKeyHandler = (key: string, event: KeyboardEvent) => boolean | void;

/** Calls `handler(key)` on keydown; returning true prevents the default action. */
export function useDrillKeys(handler: DrillKeyHandler, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isEditableTarget(e.target)) return;
      // Let a focused button handle Enter/Space itself (its native click would otherwise fire twice).
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]')) return;
      if (ref.current(e.key, e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
