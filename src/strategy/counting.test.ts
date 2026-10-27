import { describe, expect, it } from 'vitest';
import { buildDecks, EOR_8_DECKS } from '@/engine';
import type { Card, Rank } from '@/engine';
import { cardTag, countState, countStates, decksRemaining, DRAGON7_COUNT, isCountFavourable, PANDA8_COUNT, runningCount, trueCount } from './counting';
import { bettingCorrelation, cardMultiplicities, describeTagSet, formatTags, isBalanced, searchBalancedTagSets, shoeSum } from './eor';

const cards = (ranks: string): Card[] => ranks.split('').map((r, i) => ({ rank: r as Rank, suit: 'H', id: i }));

describe('counting systems', () => {
  it('DRAGON7_COUNT is Jacobson\'s balanced count with threshold 4', () => {
    expect(DRAGON7_COUNT.tags).toEqual([0, 0, 0, 0, -1, -1, -1, -1, 2, 2]);
    expect(DRAGON7_COUNT.threshold).toBe(4);
    expect(isBalanced(DRAGON7_COUNT.tags)).toBe(true);
    expect(isBalanced(DRAGON7_COUNT.tags, 6)).toBe(true);
  });

  it('PANDA8_COUNT is the derived balanced level-2 count with threshold 8', () => {
    expect(PANDA8_COUNT.tags).toEqual([1, 1, 1, -2, -2, -2, 0, -1, -1, 2]);
    expect(PANDA8_COUNT.threshold).toBe(8);
    expect(isBalanced(PANDA8_COUNT.tags)).toBe(true);
    expect(isBalanced(PANDA8_COUNT.tags, 6)).toBe(true);
    expect(Object.isFrozen(PANDA8_COUNT)).toBe(true);
    expect(Object.isFrozen(PANDA8_COUNT.tags)).toBe(true);
  });

  it('counts fixed cards', () => {
    const seen = cards('894567TA23');
    expect(runningCount(seen, DRAGON7_COUNT)).toBe(2 + 2 - 1 - 1 - 1 - 1 + 0 + 0 + 0 + 0);
    expect(runningCount(seen, PANDA8_COUNT)).toBe(-1 + 2 - 2 - 2 + 0 - 1 + 1 + 1 + 1 - 2);
    expect(runningCount(cards('TJQK'), PANDA8_COUNT)).toBe(4);
    expect(runningCount(cards('TJQK'), DRAGON7_COUNT)).toBe(0);
    expect(runningCount([], DRAGON7_COUNT)).toBe(0);
    expect(cardTag({ rank: '8', suit: 'S', id: 0 }, DRAGON7_COUNT)).toBe(2);
    expect(cardTag({ rank: '8', suit: 'S', id: 0 }, PANDA8_COUNT)).toBe(-1);
  });

  it('a whole shoe counts to zero for both systems (balanced)', () => {
    for (const decks of [6, 8]) {
      const shoe = buildDecks(decks);
      expect(runningCount(shoe, DRAGON7_COUNT)).toBe(0);
      expect(runningCount(shoe, PANDA8_COUNT)).toBe(0);
    }
  });

  it('true count divides by decks remaining with a half-deck floor', () => {
    expect(decksRemaining(104)).toBe(2);
    expect(trueCount(8, 104)).toBe(4);
    expect(trueCount(8, 52)).toBe(8);
    expect(trueCount(-6, 156)).toBe(-2);
    expect(trueCount(8, 13)).toBe(16); // 0.25 decks → floor 0.5
    expect(trueCount(8, 0)).toBe(16);
    expect(trueCount(0, 0)).toBe(0);
  });

  it('countStates / countState / isCountFavourable', () => {
    const seen = cards('8899');
    const states = countStates(seen, 208);
    expect(states.dragon7).toEqual({ running: 8, trueCount: 2 });
    expect(states.panda8).toEqual({ running: 2, trueCount: 0.5 });
    expect(countState(seen, 104, DRAGON7_COUNT)).toEqual({ running: 8, trueCount: 4 });
    expect(isCountFavourable({ running: 8, trueCount: 4 }, DRAGON7_COUNT)).toBe(true);
    expect(isCountFavourable({ running: 7, trueCount: 3.9 }, DRAGON7_COUNT)).toBe(false);
    expect(isCountFavourable({ running: 16, trueCount: 8 }, PANDA8_COUNT)).toBe(true);
  });
});

describe('EOR derivation', () => {
  it('card multiplicities and balance', () => {
    expect(cardMultiplicities(8)).toEqual([128, 32, 32, 32, 32, 32, 32, 32, 32, 32]);
    expect(cardMultiplicities(6)[0]).toBe(96);
    expect(shoeSum([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(128);
    expect(isBalanced([1, 0, 0, 0, 0, 0, 0, 0, 0, -4])).toBe(true);
    expect(isBalanced([0, 1, 1, -1, -1, -1, 0, 0, -1, 1])).toBe(false);
    expect(() => isBalanced([1, 2, 3])).toThrow(RangeError);
  });

  it('betting correlation: proportional tags correlate perfectly, the SPEC counts as documented', () => {
    const scaled = EOR_8_DECKS.dragon7.map((e) => e * 1000);
    expect(bettingCorrelation(scaled, EOR_8_DECKS.dragon7)).toBeCloseTo(1, 10);
    expect(bettingCorrelation(scaled.map((t) => -t), EOR_8_DECKS.dragon7)).toBeCloseTo(-1, 10);
    expect(bettingCorrelation(DRAGON7_COUNT.tags, EOR_8_DECKS.dragon7)).toBeCloseTo(0.9642, 3);
    expect(bettingCorrelation(PANDA8_COUNT.tags, EOR_8_DECKS.panda8)).toBeCloseTo(0.959, 3);
    expect(bettingCorrelation([0, 1, 1, -1, -1, -1, 0, 0, -1, 2], EOR_8_DECKS.panda8)).toBeCloseTo(0.9141, 3);
    expect(bettingCorrelation([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], EOR_8_DECKS.panda8)).toBe(0);
  });

  it('the exhaustive level-2 search rediscovers Jacobson\'s Dragon 7 count and our Panda 8 count', () => {
    const d7 = searchBalancedTagSets(EOR_8_DECKS.dragon7, 2, { limit: 3 });
    expect(d7[0].tags).toEqual(DRAGON7_COUNT.tags);
    expect(d7[0].correlation).toBeGreaterThan(d7[1].correlation);
    const p8 = searchBalancedTagSets(EOR_8_DECKS.panda8, 2, { limit: 3 });
    expect(p8[0].tags).toEqual(PANDA8_COUNT.tags);
    for (const c of [...d7, ...p8]) {
      expect(isBalanced(c.tags)).toBe(true);
      expect(c.level).toBeLessThanOrEqual(2);
      expect(c.correlation).toBeCloseTo(bettingCorrelation(c.tags, c === p8[0] || p8.includes(c) ? EOR_8_DECKS.panda8 : EOR_8_DECKS.dragon7), 12);
    }
    const level1 = searchBalancedTagSets(EOR_8_DECKS.panda8, 1, { limit: 1 });
    expect(level1[0].level).toBe(1);
    expect(level1[0].correlation).toBeLessThan(p8[0].correlation);
    expect(() => searchBalancedTagSets(EOR_8_DECKS.panda8, 0)).toThrow(RangeError);
  });

  it('describes and formats tag sets', () => {
    expect(describeTagSet(PANDA8_COUNT.tags)).toEqual({ level: 2, nonZero: 9 });
    expect(formatTags(DRAGON7_COUNT.tags)).toBe('4 −1, 5 −1, 6 −1, 7 −1, 8 +2, 9 +2');
    expect(formatTags([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe('all zero');
  });
});
