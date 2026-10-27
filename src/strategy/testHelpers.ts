/** Shared helpers for the strategy tests (not exported from the barrel). */
import { DEFAULT_RULES } from '@/engine';
import type { Card, HandResult, Outcome, StreakInfo } from '@/engine';
import type { StrategyContext } from './types';

export function card(id: number, rank: Card['rank'] = 'T'): Card {
  return { rank, suit: 'S', id };
}

/** A minimal HandResult with the given outcome (cards only matter for the id-based coin flip). */
export function hand(outcome: Outcome, index = 0): HandResult {
  return {
    handNumber: index + 1,
    shoeNumber: 1,
    playerCards: [card(index * 4), card(index * 4 + 2)],
    bankerCards: [card(index * 4 + 1), card(index * 4 + 3)],
    playerTotal: 0,
    bankerTotal: 0,
    outcome,
    playerNatural: false,
    bankerNatural: false,
    dragon7: false,
    panda8: false,
    playerPair: false,
    bankerPair: false,
    bankerWinOn6: false,
    cutCardDrawn: false,
    steps: [],
  };
}

export function history(outcomes: string): HandResult[] {
  const map: Record<string, Outcome> = { P: 'player', B: 'banker', T: 'tie' };
  return outcomes
    .split('')
    .filter((ch) => ch in map)
    .map((ch, i) => hand(map[ch], i));
}

/** Big-road streak of a history (ties never break a Player/Banker run). */
export function streakOf(results: readonly HandResult[]): StreakInfo {
  let streak: StreakInfo = { outcome: null, length: 0 };
  for (const r of results) {
    if (r.outcome === 'tie') {
      if (streak.outcome === null || streak.outcome === 'tie') streak = { outcome: 'tie', length: streak.length + 1 };
    } else if (streak.outcome === r.outcome) {
      streak = { outcome: r.outcome, length: streak.length + 1 };
    } else {
      streak = { outcome: r.outcome, length: 1 };
    }
  }
  return streak;
}

export function context(overrides: Partial<StrategyContext> = {}): StrategyContext {
  const shoeHistory = overrides.shoeHistory ?? [];
  const last = shoeHistory[shoeHistory.length - 1];
  return {
    shoeHistory,
    lastOutcome: last ? last.outcome : null,
    streak: streakOf(shoeHistory),
    shoe: { cardsRemaining: 300, decksRemaining: 300 / 52, cutCardReached: false },
    counts: { dragon7: { running: 0, trueCount: 0 }, panda8: { running: 0, trueCount: 0 } },
    bankroll: 1000,
    unit: 10,
    sessionNet: 0,
    handsPlayed: shoeHistory.length,
    lastMainResult: null,
    rules: DEFAULT_RULES,
    ...overrides,
  };
}
