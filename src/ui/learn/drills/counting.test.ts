import { describe, expect, it } from 'vitest';
import { RANKS, cardValue, createRng } from '@/engine';
import type { Card } from '@/engine';
import { DRAGON7_COUNT as STRATEGY_DRAGON7_COUNT, PANDA8_COUNT as STRATEGY_PANDA8_COUNT, cardTag, runningCount, trueCount } from '@/strategy';
import {
  COUNT_LENGTHS,
  DRAGON7_COUNT,
  DRILL_COUNT_SYSTEMS,
  PANDA8_COUNT,
  cardTagOf,
  countSystemById,
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
import { questionSeed } from './seeds';

describe('count systems', () => {
  it('are the @/strategy systems (the Coach, the lessons and the drills must teach the same counts)', () => {
    expect(DRAGON7_COUNT.tags).toEqual(STRATEGY_DRAGON7_COUNT.tags);
    expect(DRAGON7_COUNT.threshold).toBe(STRATEGY_DRAGON7_COUNT.threshold);
    expect(DRAGON7_COUNT.description).toBe(STRATEGY_DRAGON7_COUNT.description);
    expect(PANDA8_COUNT.tags).toEqual(STRATEGY_PANDA8_COUNT.tags);
    expect(PANDA8_COUNT.threshold).toBe(STRATEGY_PANDA8_COUNT.threshold);
    expect(PANDA8_COUNT.description).toBe(STRATEGY_PANDA8_COUNT.description);
  });
  it('Dragon 7 uses Jacobson’s tags (SPEC §3) with threshold 4; Panda 8 is the derived level-2 count with threshold 8', () => {
    expect(DRAGON7_COUNT.tags).toEqual([0, 0, 0, 0, -1, -1, -1, -1, 2, 2]);
    expect(DRAGON7_COUNT.threshold).toBe(4);
    expect(PANDA8_COUNT.tags).toEqual([1, 1, 1, -2, -2, -2, 0, -1, -1, 2]);
    expect(PANDA8_COUNT.threshold).toBe(8);
    expect(DRILL_COUNT_SYSTEMS.map((s) => s.id)).toEqual(['dragon7', 'panda8']);
    expect(countSystemById('panda8')).toBe(PANDA8_COUNT);
    expect(countSystemById('nope')).toBe(DRAGON7_COUNT);
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
    expect(tagGroups(PANDA8_COUNT)).toEqual([
      { tag: 2, values: [9] },
      { tag: 1, values: [0, 1, 2] },
      { tag: -1, values: [7, 8] },
      { tag: -2, values: [3, 4, 5] },
      { tag: 0, values: [6] },
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
  it('respects the deck count (a 6-deck shoe holds at most six copies of a card)', () => {
    const shoe = generateCountingCards(createRng(3), 312, 6);
    expect(shoe).toHaveLength(312);
    const copies = new Map<string, number>();
    for (const c of shoe) copies.set(`${c.rank}${c.suit}`, (copies.get(`${c.rank}${c.suit}`) ?? 0) + 1);
    expect(copies.size).toBe(52);
    for (const count of copies.values()) expect(count).toBe(6);
    expect(generateCountingCards(createRng(3), 400, 6)).toHaveLength(312);
  });
});

describe('counts', () => {
  const card = (rank: Card['rank'], id: number): Card => ({ rank, suit: 'H', id });
  it('runs the count card by card', () => {
    const cards = [card('8', 0), card('4', 1), card('K', 2), card('9', 3), card('7', 4)];
    expect(cumulativeCounts(cards, DRAGON7_COUNT)).toEqual([2, 1, 1, 3, 2]);
    expect(runningCountOf(cards, DRAGON7_COUNT)).toBe(2);
    // Panda 8: 8 = −1, 4 = −2, K = +1, 9 = +2, 7 = −1.
    expect(cumulativeCounts(cards, PANDA8_COUNT)).toEqual([-1, -3, -2, 0, -1]);
    expect(runningCountOf(cards, PANDA8_COUNT)).toBe(-1);
    expect(cumulativeCounts([], PANDA8_COUNT)).toEqual([]);
  });
  it('agrees with @/strategy runningCount / cardTag on seeded deals (the oracle of the drill)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const cards = generateCountingCards(createRng(questionSeed(seed, 0)), COUNT_LENGTHS[seed % COUNT_LENGTHS.length]);
      for (const system of DRILL_COUNT_SYSTEMS) {
        const running = cumulativeCounts(cards, system);
        expect(runningCountOf(cards, system)).toBe(runningCount(cards, system));
        expect(running[running.length - 1]).toBe(runningCount(cards, system));
        for (let i = 0; i < cards.length; i++) {
          expect(cardTagOf(cards[i], system)).toBe(cardTag(cards[i], system));
          expect(running[i]).toBe(runningCount(cards.slice(0, i + 1), system));
        }
      }
    }
  });
  it('estimates the true count with the half-deck floor, per the strategy module, for 6 and 8 decks', () => {
    expect(trueCountEstimate(4, 208)).toBe(1);
    expect(trueCountEstimate(2, 416)).toBe(4);
    expect(trueCountEstimate(-3, 0)).toBeCloseTo(-0.375);
    expect(trueCountEstimate(6, 156, 6)).toBe(2);
    for (const decks of [6, 8] as const) {
      for (const seen of [0, 8, 52, 300, 416]) {
        expect(trueCountEstimate(5, seen, decks)).toBe(trueCount(5, Math.max(0, decks * 52 - seen)));
      }
    }
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
