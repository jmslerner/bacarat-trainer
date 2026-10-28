import { EXACT_8_DECKS, type Side } from '@/engine';
import type { RoadResult } from './types';

/**
 * Dragon 7 / Panda 8 bookkeeping for the scoreboard: which hands of the shoe hit, how long ago the last hit was and
 * how often a hit is expected. Everything is derived from the `results` array (the newest hand is its last element),
 * so a view needs no extra props to show it.
 */
export type BonusKind = 'dragon7' | 'panda8';

export const BONUS_KINDS: readonly BonusKind[] = ['dragon7', 'panda8'];

export const BONUS_LABELS: Record<BonusKind, string> = { dragon7: 'Dragon 7', panda8: 'Panda 8' };

export const BONUS_ABBR: Record<BonusKind, string> = { dragon7: 'D7', panda8: 'P8' };

/** The digit shown on the medallion. */
export const BONUS_GLYPH: Record<BonusKind, string> = { dragon7: '7', panda8: '8' };

/** The side that wins the hand on each bonus. */
export const BONUS_SIDE: Record<BonusKind, Side> = { dragon7: 'banker', panda8: 'player' };

/** What the hit is, in a player's words (payouts belong to the table, which can change them). */
export const BONUS_DESCRIPTION: Record<BonusKind, string> = {
  dragon7: 'Banker wins with a three-card 7',
  panda8: 'Player wins with a three-card 8',
};

/**
 * Long-run frequency of a hit, "about one hand in N" (from the exact 8-deck probabilities; the 6-deck figures round
 * to the same N, so the scoreboard needs no knowledge of the table).
 */
export const BONUS_EXPECTED_EVERY: Record<BonusKind, number> = {
  dragon7: Math.round(1 / EXACT_8_DECKS.dragon7),
  panda8: Math.round(1 / EXACT_8_DECKS.panda8),
};

export interface BonusHit {
  kind: BonusKind;
  /** 0-based index of the hand in the `results` array. */
  handIndex: number;
  /** 1-based hand number, as the scoreboard's "Hand N" counts them. */
  hand: number;
}

export interface BonusTally {
  kind: BonusKind;
  count: number;
  /** The most recent hit of this kind, or null. */
  last: BonusHit | null;
  /** Hands dealt after the last hit (0 when the newest hand is the hit); every hand of the shoe when there is none. */
  handsSince: number;
  /** About one hit per this many hands. */
  expectedEvery: number;
  /** True when the newest hand is a hit of this kind. */
  latest: boolean;
}

export interface BonusHistory {
  /** Hands dealt. */
  total: number;
  /** Every hit of the shoe, in hand order. */
  hits: BonusHit[];
  dragon7: BonusTally;
  panda8: BonusTally;
  /** The bonus the newest hand hit, or null. */
  latest: BonusKind | null;
}

/**
 * The bonus a result hit, or null. A hand cannot be both (a Dragon 7 is a Banker win, a Panda 8 a Player win); if a
 * result were flagged with both, the Dragon 7 wins.
 */
export function bonusOf(result: RoadResult | undefined): BonusKind | null {
  if (result === undefined) return null;
  if (result.dragon7 === true) return 'dragon7';
  if (result.panda8 === true) return 'panda8';
  return null;
}

function tally(kind: BonusKind, hits: readonly BonusHit[], total: number): BonusTally {
  const own = hits.filter((hit) => hit.kind === kind);
  const last = own.at(-1) ?? null;
  return {
    kind,
    count: own.length,
    last,
    handsSince: last === null ? total : total - last.hand,
    expectedEvery: BONUS_EXPECTED_EVERY[kind],
    latest: last !== null && last.hand === total,
  };
}

/** Dragon 7 / Panda 8 hits of the shoe with their hand numbers, hands since the last one and the expected frequency. */
export function bonusHistory(results: readonly RoadResult[]): BonusHistory {
  const hits: BonusHit[] = [];
  results.forEach((result, handIndex) => {
    const kind = bonusOf(result);
    if (kind !== null) hits.push({ kind, handIndex, hand: handIndex + 1 });
  });
  const total = results.length;
  const last = hits.at(-1);
  return {
    total,
    hits,
    dragon7: tally('dragon7', hits, total),
    panda8: tally('panda8', hits, total),
    latest: last !== undefined && last.hand === total ? last.kind : null,
  };
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** "this hand", "1 hand ago", "23 hands ago". */
export function handsAgoText(handsSince: number): string {
  return handsSince === 0 ? 'this hand' : `${plural(handsSince, 'hand')} ago`;
}

/** Accessible name of a hit cell: "Hand 12: Banker, Dragon 7". */
export function bonusHitLabel(kind: BonusKind, hand: number): string {
  return `Hand ${hand}: ${BONUS_SIDE[kind] === 'banker' ? 'Banker' : 'Player'}, ${BONUS_LABELS[kind]}`;
}

/** Tooltip of a hit: "Dragon 7 on hand 12 — Banker wins with a three-card 7". */
export function bonusHitTitle(kind: BonusKind, hand: number): string {
  return `${BONUS_LABELS[kind]} on hand ${hand} — ${BONUS_DESCRIPTION[kind]}`;
}

/** The bonus-history line: "Since last Dragon 7: 23 hands (expected about 1 in 44)". */
export function bonusSinceText(t: BonusTally): string {
  const expected = `(expected about 1 in ${t.expectedEvery})`;
  if (t.last === null) {
    return t.handsSince === 0
      ? `No ${BONUS_LABELS[t.kind]} yet ${expected}`
      : `No ${BONUS_LABELS[t.kind]} in ${plural(t.handsSince, 'hand')} ${expected}`;
  }
  const since = t.handsSince === 0 ? 'this hand' : plural(t.handsSince, 'hand');
  return `Since last ${BONUS_LABELS[t.kind]}: ${since} ${expected}`;
}

/** Tooltip of a counter: "Dragon 7 × 2 · last D7: hand 23 · 58 hands ago · expected about 1 in 44 hands". */
export function bonusCountTitle(t: BonusTally): string {
  const label = BONUS_LABELS[t.kind];
  const expected = `expected about 1 in ${t.expectedEvery} hands`;
  if (t.last === null) return `${label} — none yet this shoe · ${expected}`;
  return `${label} × ${t.count} · last ${BONUS_ABBR[t.kind]}: hand ${t.last.hand} · ${handsAgoText(t.handsSince)} · ${expected}`;
}
