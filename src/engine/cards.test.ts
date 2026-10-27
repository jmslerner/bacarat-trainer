import { describe, expect, it } from 'vitest';
import { buildDecks, cardLabel, cardValue, handTotal, isRank, isRedSuit, RANKS, rankLabel, SUITS, suitSymbol } from './cards';
import type { Card, Rank } from './types';

const c = (rank: Rank, suit: Card['suit'] = 'S', id = 0): Card => ({ rank, suit, id });

describe('cards', () => {
  it('values: Ace = 1, 2–9 face value, tens and faces = 0', () => {
    const expected: Record<Rank, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 0, J: 0, Q: 0, K: 0 };
    for (const rank of RANKS) expect(cardValue(rank)).toBe(expected[rank]);
    expect(RANKS).toHaveLength(13);
    expect(SUITS).toEqual(['S', 'H', 'D', 'C']);
  });

  it('hand totals are the sum modulo 10', () => {
    expect(handTotal([])).toBe(0);
    expect(handTotal([c('9'), c('9')])).toBe(8);
    expect(handTotal([c('T'), c('5')])).toBe(5);
    expect(handTotal([c('A'), c('2'), c('3')])).toBe(6);
    expect(handTotal([c('K'), c('Q')])).toBe(0);
    expect(handTotal([c('7'), c('8'), c('9')])).toBe(4);
  });

  it('labels show the ten as "10" with suit symbols', () => {
    expect(rankLabel('T')).toBe('10');
    expect(rankLabel('A')).toBe('A');
    expect(rankLabel('7')).toBe('7');
    expect(cardLabel(c('T', 'H'))).toBe('10♥');
    expect(cardLabel(c('A', 'S'))).toBe('A♠');
    expect(cardLabel(c('K', 'C'))).toBe('K♣');
    expect(cardLabel(c('9', 'D'))).toBe('9♦');
    expect(suitSymbol('D')).toBe('♦');
    expect(isRedSuit('H')).toBe(true);
    expect(isRedSuit('D')).toBe(true);
    expect(isRedSuit('S')).toBe(false);
    expect(isRedSuit('C')).toBe(false);
  });

  it('isRank recognises the thirteen ranks only', () => {
    for (const r of RANKS) expect(isRank(r)).toBe(true);
    expect(isRank('10')).toBe(false);
    expect(isRank('X')).toBe(false);
    expect(isRank(7)).toBe(false);
  });

  it('builds complete decks with sequential ids', () => {
    const eight = buildDecks(8);
    expect(eight).toHaveLength(416);
    expect(new Set(eight.map((x) => x.id)).size).toBe(416);
    expect(eight.map((x) => x.id)).toEqual(Array.from({ length: 416 }, (_, i) => i));
    for (const rank of RANKS) expect(eight.filter((x) => x.rank === rank)).toHaveLength(32);
    for (const suit of SUITS) expect(eight.filter((x) => x.suit === suit)).toHaveLength(104);

    const six = buildDecks(6);
    expect(six).toHaveLength(312);
    for (const rank of RANKS) expect(six.filter((x) => x.rank === rank)).toHaveLength(24);

    expect(buildDecks(1)).toHaveLength(52);
    expect(() => buildDecks(0)).toThrow(RangeError);
    expect(() => buildDecks(1.5)).toThrow(RangeError);
  });
});
