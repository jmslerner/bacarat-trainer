/**
 * The bankroll as the table DISPLAYS it.
 *
 * `GameSession.deal()` settles a hand synchronously, so the live session state jumps to the new bankroll the
 * moment DEAL is pressed — while the table is still dealing the cards. The Play view publishes the figure it is
 * showing (the pre-deal bankroll while a hand plays, then the animated count to the new value) so the top bar's
 * bankroll pill moves with the table instead of giving the result away. Null = nothing published: follow the
 * live session (Learn and Lab, or no table mounted).
 */
import { useSyncExternalStore } from 'react';

export interface DisplayedBankroll {
  bankroll: number;
  /** Session net as displayed (bankroll − starting bankroll). */
  net: number;
}

let current: DisplayedBankroll | null = null;
const listeners = new Set<() => void>();

function same(a: DisplayedBankroll | null, b: DisplayedBankroll | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.bankroll === b.bankroll && a.net === b.net;
}

/** Publish what the table shows (null to follow the live session again). No-op when nothing changed. */
export function publishDisplayedBankroll(value: DisplayedBankroll | null): void {
  if (same(current, value)) return;
  current = value;
  for (const listener of listeners) listener();
}

export function getDisplayedBankroll(): DisplayedBankroll | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getServerSnapshot = (): DisplayedBankroll | null => null;

/** The displayed bankroll, or null when the live session figure should be shown. */
export function useDisplayedBankroll(): DisplayedBankroll | null {
  return useSyncExternalStore(subscribe, getDisplayedBankroll, getServerSnapshot);
}
