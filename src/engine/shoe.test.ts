import { describe, expect, it } from 'vitest';
import { burnCountForRank, Shoe } from './shoe';
import { createRng } from './rng';
import { buildDecks, cardValue, RANKS, SUITS } from './cards';
import { cloneRules, DEFAULT_RULES } from './rules';
import type { Card, Rank, TableRules } from './types';

const NO_BURN: TableRules = { ...cloneRules(DEFAULT_RULES), burnProcedure: false };

function drainShoe(shoe: Shoe): Card[] {
  const out: Card[] = [];
  while (shoe.cardsRemaining() > 0) out.push(shoe.draw());
  return out;
}

describe('Shoe composition', () => {
  it('an 8-deck shoe holds 416 unique ids in draw order, 32 of each rank and 104 of each suit', () => {
    const shoe = new Shoe(DEFAULT_RULES, createRng(2024), 1);
    expect(shoe.totalCards).toBe(416);
    const all: Card[] = [shoe.exposedBurnCard as Card, ...shoe.burnedCards, ...drainShoe(shoe)];
    expect(all).toHaveLength(416);
    expect(all.map((c) => c.id)).toEqual(Array.from({ length: 416 }, (_, i) => i));
    for (const rank of RANKS) expect(all.filter((c) => c.rank === rank)).toHaveLength(32);
    for (const suit of SUITS) expect(all.filter((c) => c.suit === suit)).toHaveLength(104);
    expect(shoe.cardsDealt()).toBe(416);
    expect(shoe.cardsRemaining()).toBe(0);
  });

  it('a 6-deck shoe holds 312 cards, 24 of each rank', () => {
    const shoe = new Shoe({ ...NO_BURN, decks: 6 }, createRng(5), 1);
    expect(shoe.totalCards).toBe(312);
    const all = drainShoe(shoe);
    expect(all).toHaveLength(312);
    expect(new Set(all.map((c) => c.id)).size).toBe(312);
    for (const rank of RANKS) expect(all.filter((c) => c.rank === rank)).toHaveLength(24);
  });

  it('is shuffled (not in build order) and the shuffle is a permutation', () => {
    const shoe = new Shoe(NO_BURN, createRng(42), 1);
    const drawn = drainShoe(shoe).map((c) => `${c.rank}${c.suit}`);
    const built = buildDecks(8).map((c) => `${c.rank}${c.suit}`);
    expect(drawn).not.toEqual(built);
    expect([...drawn].sort()).toEqual([...built].sort());
  });

  it('throws a RangeError when empty', () => {
    const shoe = new Shoe(NO_BURN, createRng(1), 1);
    drainShoe(shoe);
    expect(() => shoe.draw()).toThrow(RangeError);
  });
});

describe('Shoe cut card', () => {
  it('sits cutCardFromEnd cards from the end and flags when the card behind it is drawn', () => {
    const shoe = new Shoe(NO_BURN, createRng(3), 1);
    expect(shoe.cutCardIndex).toBe(416 - 14);
    for (let i = 0; i < 402; i++) {
      expect(shoe.cutCardReached).toBe(false);
      shoe.draw();
    }
    expect(shoe.cutCardReached).toBe(false);
    const card = shoe.draw();
    expect(card.id).toBe(402);
    expect(shoe.cutCardReached).toBe(true);
    expect(shoe.cardsRemaining()).toBe(13);
  });

  it('respects a different depth and deck count', () => {
    const shoe = new Shoe({ ...NO_BURN, decks: 6, cutCardFromEnd: 52 }, createRng(3), 1);
    expect(shoe.cutCardIndex).toBe(312 - 52);
  });
});

describe('Shoe burn procedure', () => {
  it('burns A=1, 2–9 face value, T/J/Q/K=10 cards after the exposed card', () => {
    const expected: Record<Rank, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 10, Q: 10, K: 10 };
    for (const rank of RANKS) expect(burnCountForRank(rank)).toBe(expected[rank]);
  });

  it('exposes the first card, burns the right number face down and counts them as dealt', () => {
    const seen = new Set<Rank>();
    for (let seed = 1; seed <= 300; seed++) {
      const shoe = new Shoe(DEFAULT_RULES, createRng(seed), 1);
      const exposed = shoe.exposedBurnCard;
      expect(exposed).not.toBeNull();
      const card = exposed as Card;
      expect(card.id).toBe(0);
      const burn = cardValue(card.rank) === 0 ? 10 : cardValue(card.rank);
      expect(shoe.burnedCards).toHaveLength(burn);
      expect(shoe.burnedCards.map((c) => c.id)).toEqual(Array.from({ length: burn }, (_, i) => i + 1));
      expect(shoe.cardsDealt()).toBe(1 + burn);
      expect(shoe.cardsRemaining()).toBe(416 - 1 - burn);
      expect(shoe.draw().id).toBe(1 + burn);
      expect(shoe.cutCardReached).toBe(false);
      seen.add(card.rank);
    }
    expect(seen.size).toBe(13);
  });

  it('does nothing when the procedure is off', () => {
    const shoe = new Shoe(NO_BURN, createRng(8), 1);
    expect(shoe.exposedBurnCard).toBeNull();
    expect(shoe.burnedCards).toEqual([]);
    expect(shoe.cardsDealt()).toBe(0);
    expect(shoe.draw().id).toBe(0);
  });
});

describe('Shoe reproducibility and info', () => {
  it('the same seed deals the same shoe; different seeds differ', () => {
    const a = drainShoe(new Shoe(DEFAULT_RULES, createRng(777), 1));
    const b = drainShoe(new Shoe(DEFAULT_RULES, createRng(777), 1));
    const c = drainShoe(new Shoe(DEFAULT_RULES, createRng(778), 1));
    expect(a).toEqual(b);
    expect(a.map((x) => x.rank + x.suit)).not.toEqual(c.map((x) => x.rank + x.suit));
  });

  it('info() reports the shoe exactly', () => {
    const shoe = new Shoe(DEFAULT_RULES, createRng(11), 4);
    const burned = shoe.burnedCards.length;
    shoe.draw();
    shoe.draw();
    expect(shoe.info(1, false)).toEqual({
      shoeNumber: 4,
      totalCards: 416,
      cardsRemaining: 416 - burned - 3,
      cardsDealt: burned + 3,
      cutCardReached: false,
      lastHandNext: false,
      exposedBurnCard: shoe.exposedBurnCard,
      burnedCount: burned,
      handsDealt: 1,
    });
    expect(shoe.shoeNumber).toBe(4);
    expect(new Shoe(DEFAULT_RULES, createRng(1)).shoeNumber).toBe(1);
  });

  it('fromCards deals the given cards in order with ids reassigned', () => {
    const cards: Card[] = [
      { rank: '9', suit: 'H', id: 50 },
      { rank: 'K', suit: 'S', id: 50 },
      { rank: 'A', suit: 'D', id: 9 },
    ];
    const shoe = Shoe.fromCards(cards, { ...NO_BURN, cutCardFromEnd: 1 }, 7);
    expect(shoe.totalCards).toBe(3);
    expect(shoe.shoeNumber).toBe(7);
    expect(shoe.cutCardIndex).toBe(2);
    expect(shoe.exposedBurnCard).toBeNull();
    expect(shoe.draw()).toEqual({ rank: '9', suit: 'H', id: 0 });
    expect(shoe.draw()).toEqual({ rank: 'K', suit: 'S', id: 1 });
    expect(shoe.cutCardReached).toBe(false);
    expect(shoe.draw()).toEqual({ rank: 'A', suit: 'D', id: 2 });
    expect(shoe.cutCardReached).toBe(true);
    expect(() => shoe.draw()).toThrow(RangeError);
  });

  it('fromCards still runs the burn procedure when the rules ask for it', () => {
    const cards: Card[] = [
      { rank: '2', suit: 'H', id: 0 },
      { rank: 'K', suit: 'S', id: 1 },
      { rank: 'A', suit: 'D', id: 2 },
      { rank: '5', suit: 'C', id: 3 },
    ];
    const shoe = Shoe.fromCards(cards, { ...cloneRules(DEFAULT_RULES), cutCardFromEnd: 1 }, 1);
    expect(shoe.exposedBurnCard?.rank).toBe('2');
    expect(shoe.burnedCards.map((c) => c.rank)).toEqual(['K', 'A']);
    expect(shoe.cardsDealt()).toBe(3);
    expect(shoe.draw().rank).toBe('5');
  });
});
