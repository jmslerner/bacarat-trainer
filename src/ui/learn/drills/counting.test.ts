import { describe, expect, it } from 'vitest';
import { RANKS, cardValue, createRng } from '@/engine';
import type { Card } from '@/engine';
import {
  COUNT_LENGTHS,
  DRAGON7_COUNT,
  DRILL_COUNT_SYSTEMS,
  PANDA8_COUNT,
  cumulativeCounts,
  formatCount,
  generateCountingCards,
  paceMs,
  parseCountAnswer,
  runningCountOf,
  tagGroups,
  trueCountEstimate,
  valueLabel,
} from './counting';

describe('count systems', () => {
  it('Dragon 7 uses Jacobson’s tags (SPEC §3) with threshold 4', () => {
    expect(DRAGON7_COUNT.tags).toEqual([0, 0, 0, 0, -1, -1, -1, -1, 2, 2]);
    expect(DRAGON7_COUNT.threshold).toBe(4);
    expect(PANDA8_COUNT.threshold).toBe(8);
    expect(DRILL_COUNT_SYSTEMS.map((s) => s.id)).toEqual(['dragon7', 'panda8']);
  });
  it('both systems are balanced over a deck', () => {
    for (const system of DRILL_COUNT_SYSTEMS) {
      const sum = RANKS.reduce((t, r) => t + system.tags[cardValue(r)], 0);
      expect(sum).toBe(0);
      expect(system.tags).toHaveLength(10);
    }
  });
  it('groups tags for the legend', () => {
    expect(tagGroups(DRAGON7_COUNT)).toEqual([
      { tag: 2, values: [8, 9] },
      { tag: -1, values: [4, 5, 6, 7] },
      { tag: 0, values: [0, 1, 2, 3] },
    ]);
    expect(valueLabel(0)).toBe('10/J/Q/K');
    expect(valueLabel(1)).toBe('A');
    expect(valueLabel(7)).toBe('7');
  });
});

describe('generateCountingCards', () => {
  it('deals the requested number of cards from a realistic shoe, deterministically', () => {
    for (const n of COUNT_LENGTHS) {
      const cards = generateCountingCards(createRng(n), n);
      expect(cards).toHaveLength(n);
      expect(cards.map((c) => c.id)).toEqual(cards.map((_, i) => i));
      const copies = new Map<string, number>();
      for (const c of cards) copies.set(`${c.rank}${c.suit}`, (copies.get(`${c.rank}${c.suit}`) ?? 0) + 1);
      for (const count of copies.values()) expect(count).toBeLessThanOrEqual(8);
    }
    expect(generateCountingCards(createRng(1), 16)).toEqual(generateCountingCards(createRng(1), 16));
    expect(generateCountingCards(createRng(1), 16)).not.toEqual(generateCountingCards(createRng(2), 16));
  });
});

describe('counts', () => {
  const card = (rank: Card['rank'], id: number): Card => ({ rank, suit: 'H', id });
  it('runs the count card by card', () => {
    const cards = [card('8', 0), card('4', 1), card('K', 2), card('9', 3), card('7', 4)];
    expect(cumulativeCounts(cards, DRAGON7_COUNT)).toEqual([2, 1, 1, 3, 2]);
    expect(runningCountOf(cards, DRAGON7_COUNT)).toBe(2);
    expect(cumulativeCounts(cards, PANDA8_COUNT)).toEqual([-2, -3, -2, 0, -1]);
  });
  it('estimates the true count with the half-deck floor', () => {
    expect(trueCountEstimate(4, 208)).toBe(1);
    expect(trueCountEstimate(2, 416)).toBe(4);
    expect(trueCountEstimate(-3, 0)).toBeCloseTo(-0.375);
  });
  it('formats and parses counts', () => {
    expect(formatCount(3)).toBe('+3');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(-2)).toBe('−2');
    expect(parseCountAnswer('+3')).toBe(3);
    expect(parseCountAnswer(' -2 ')).toBe(-2);
    expect(parseCountAnswer('−2')).toBe(-2);
    expect(parseCountAnswer('0')).toBe(0);
    expect(parseCountAnswer('2.5')).toBeNull();
    expect(parseCountAnswer('')).toBeNull();
    expect(paceMs('blitz')).toBe(400);
    expect(paceMs('normal')).toBe(1000);
  });
});
