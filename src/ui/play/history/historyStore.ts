/**
 * Hand history for the Play view (newest first), kept in memory for the life of the page so leaving for Learn and
 * coming back keeps the list. Entries are appended when a hand's settlement is revealed.
 */
import { useSyncExternalStore } from 'react';
import type { HandResult, HandSettlement, SessionState } from '@/engine';

export interface HistoryEntry {
  key: string;
  shoeNumber: number;
  handNumber: number;
  /** 1-based hand number over the whole session. */
  sessionHand: number;
  result: HandResult;
  /** null when the net is unknown (hands dealt before the view mounted). */
  settlement: HandSettlement | null;
}

export const HISTORY_LIMIT = 300;

interface HistoryState {
  entries: readonly HistoryEntry[];
  /** `SessionState.totalHands` after the last recorded hand, to detect a reset session. */
  totalHands: number;
  seed: number | null;
}

let state: HistoryState = { entries: [], totalHands: 0, seed: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function set(next: HistoryState): void {
  state = next;
  emit();
}

export function getHistory(): readonly HistoryEntry[] {
  return state.entries;
}

export function clearHistory(): void {
  set({ entries: [], totalHands: 0, seed: null });
}

/** Records a settled hand (`totalHands` = the session's count after it). */
export function recordHand(result: HandResult, settlement: HandSettlement, totalHands: number, seed: number): void {
  const entry: HistoryEntry = {
    key: `${seed}:${totalHands}:${result.shoeNumber}:${result.handNumber}`,
    shoeNumber: result.shoeNumber,
    handNumber: result.handNumber,
    sessionHand: totalHands,
    result,
    settlement,
  };
  // Idempotent: a hand already seeded for this slot (same key) is replaced by the entry that knows its net.
  const entries = [entry, ...state.entries.filter((e) => e.key !== entry.key)].slice(0, HISTORY_LIMIT);
  set({ entries, totalHands, seed });
}

/**
 * Brings the store in line with a session snapshot: a reset session (fewer hands, other seed) empties the list and
 * hands dealt while the view was not mounted are seeded from the shoe history without a net.
 */
export function syncHistory(session: SessionState): void {
  const reset = state.seed !== null && (session.seed !== state.seed || session.totalHands < state.totalHands);
  if (reset) state = { entries: [], totalHands: 0, seed: null };
  if (session.totalHands === state.totalHands && state.seed !== null) return;
  if (session.totalHands === 0) {
    if (state.entries.length > 0 || state.seed === null) set({ entries: [], totalHands: 0, seed: session.seed });
    return;
  }
  // Hands we never saw: the current shoe's history (older shoes are gone from the session).
  const known = new Set(state.entries.map((e) => `${e.shoeNumber}:${e.handNumber}`));
  const missing = session.shoeHistory.filter((r) => !known.has(`${r.shoeNumber}:${r.handNumber}`));
  const firstSessionHand = session.totalHands - session.shoeHistory.length;
  const seeded: HistoryEntry[] = missing.map((result) => {
    const idx = session.shoeHistory.indexOf(result);
    const sessionHand = firstSessionHand + idx + 1;
    const isLast = session.lastHand !== null && session.lastHand.result === result;
    return {
      key: `${session.seed}:${sessionHand}:${result.shoeNumber}:${result.handNumber}`,
      shoeNumber: result.shoeNumber,
      handNumber: result.handNumber,
      sessionHand,
      result,
      settlement: isLast ? session.lastHand!.settlement : null,
    };
  });
  const entries = [...seeded.reverse(), ...state.entries].slice(0, HISTORY_LIMIT);
  set({ entries, totalHands: session.totalHands, seed: session.seed });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHistory(): readonly HistoryEntry[] {
  return useSyncExternalStore(subscribe, getHistory, getHistory);
}

/** Largest single-hand win and loss among the recorded hands with a known net. */
export function historyExtremes(entries: readonly HistoryEntry[]): { biggestWin: number; biggestLoss: number } {
  let biggestWin = 0;
  let biggestLoss = 0;
  for (const e of entries) {
    if (!e.settlement) continue;
    if (e.settlement.net > biggestWin) biggestWin = e.settlement.net;
    if (e.settlement.net < biggestLoss) biggestLoss = e.settlement.net;
  }
  return { biggestWin, biggestLoss };
}
