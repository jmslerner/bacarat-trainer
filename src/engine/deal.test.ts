import { describe, expect, it } from 'vitest';
import { cardsFromValues, dealFromValues, dealHand, evaluateHand, MSG_CUT_CARD, type CardSpec } from './deal';
import { Shoe } from './shoe';
import { createRng } from './rng';
import { cloneRules, DEFAULT_RULES } from './rules';
import type { Card, DealStep, HandResult, TableRules } from './types';

const NO_BURN: TableRules = { ...cloneRules(DEFAULT_RULES), burnProcedure: false };

/** A shoe that deals exactly these cards (no burn; cut card never reached unless `cutCardFromEnd` is given). */
function scripted(specs: CardSpec[], cutCardFromEnd = 0, rules: TableRules = NO_BURN): Shoe {
  return Shoe.fromCards(cardsFromValues(specs), { ...rules, cutCardFromEnd }, 1);
}

const ids = (cards: Card[]): number[] => cards.map((c) => c.id);
const ranks = (cards: Card[]): string[] => cards.map((c) => c.rank);
const types = (steps: DealStep[]): string[] => steps.map((s) => s.type);
const messages = (steps: DealStep[]): string[] => steps.map((s) => s.message);

/** SPEC §2: Banker total → Player third-card values on which Banker DRAWS. */
const BANKER_DRAWS_ON: Record<number, number[]> = {
  0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  3: [0, 1, 2, 3, 4, 5, 6, 7, 9],
  4: [2, 3, 4, 5, 6, 7],
  5: [4, 5, 6, 7],
  6: [6, 7],
  7: [],
};

describe('dealHand: casino dealing order', () => {
  it('deals Player, Banker, Player, Banker, then the third cards Player first', () => {
    // P0=2 B0=A P1=3 B1=2 | Player 5 draws P2=4 → 9 | Banker 3 (P3=4 → draws) B2=5 → 8
    const shoe = scripted([2, 1, 3, 2, 4, 5]);
    const r = dealHand(shoe, NO_BURN, 1);
    expect(ids(r.playerCards)).toEqual([0, 2, 4]);
    expect(ids(r.bankerCards)).toEqual([1, 3, 5]);
    expect(ranks(r.playerCards)).toEqual(['2', '3', '4']);
    expect(ranks(r.bankerCards)).toEqual(['A', '2', '5']);
    expect(r.playerTotal).toBe(9);
    expect(r.bankerTotal).toBe(8);
    expect(r.outcome).toBe('player');
    expect(r.handNumber).toBe(1);
    expect(r.shoeNumber).toBe(1);
    expect(shoe.cardsDealt()).toBe(6);
    const dealSteps = r.steps.filter((s) => s.type === 'deal');
    expect(dealSteps.map((s) => (s.type === 'deal' ? `${s.to}${s.index}:${s.card.id}` : ''))).toEqual([
      'player0:0', 'banker0:1', 'player1:2', 'banker1:3', 'player2:4', 'banker2:5',
    ]);
  });

  it('propagates hand and shoe numbers', () => {
    const shoe = Shoe.fromCards(cardsFromValues([4, 1, 5, 2]), { ...NO_BURN, cutCardFromEnd: 0 }, 3);
    const r = dealHand(shoe, NO_BURN, 12);
    expect(r.handNumber).toBe(12);
    expect(r.shoeNumber).toBe(3);
  });

  it('totals wrap modulo 10', () => {
    const r = dealFromValues([7, 8, 9], [6, 6, 9]);
    // Player 7+8 = 15 → 5, draws 9 → 14 → 4; Banker 6+6 = 12 → 2, draws 9 → 11 → 1
    expect(r.playerTotal).toBe(4);
    expect(r.bankerTotal).toBe(1);
    expect(r.bankerCards).toHaveLength(3);
    expect(r.outcome).toBe('player');
  });
});

describe('dealHand: naturals', () => {
  it('a natural 9 against a drawing total ends the hand with two cards each', () => {
    const r = dealHand(scripted([4, 1, 5, 2, 7, 7]), NO_BURN, 1);
    expect(r.playerCards).toHaveLength(2);
    expect(r.bankerCards).toHaveLength(2);
    expect(r.playerNatural).toBe(true);
    expect(r.bankerNatural).toBe(false);
    expect(r.outcome).toBe('player');
    expect(types(r.steps)).toEqual(['deal', 'deal', 'deal', 'deal', 'show', 'natural', 'result']);
    expect(messages(r.steps)).toEqual([
      'Card to Player', 'Card to Banker', 'Card to Player', 'Card to Banker',
      'Player shows 9, Banker shows 3', 'Natural 9 — Player', 'Player wins, 9 over 3',
    ]);
    const natural = r.steps[5];
    expect(natural.type === 'natural' && natural.side).toBe('player');
  });

  it('a Banker natural stops the Player from drawing on 0–5', () => {
    const r = dealFromValues([2, 3, 9], [3, 5, 9]);
    expect(r.playerCards).toHaveLength(2);
    expect(r.bankerCards).toHaveLength(2);
    expect(r.bankerNatural).toBe(true);
    expect(r.playerNatural).toBe(false);
    expect(r.outcome).toBe('banker');
    expect(messages(r.steps).slice(4)).toEqual(['Player shows 5, Banker shows 8', 'Natural 8 — Banker', 'Banker wins, 8 over 5']);
  });

  it('two naturals: 9 beats 8, equal naturals tie', () => {
    const r = dealFromValues([4, 5], [3, 5]);
    expect(r.playerNatural && r.bankerNatural).toBe(true);
    expect(r.outcome).toBe('player');
    const natural = r.steps.find((s) => s.type === 'natural');
    expect(natural).toEqual({ type: 'natural', side: 'both', message: 'Natural 9 — Player, Natural 8 — Banker' });

    const t = dealFromValues([3, 5], [2, 6]);
    expect(t.outcome).toBe('tie');
    expect(t.panda8).toBe(false);
    expect(messages(t.steps).at(-1)).toBe('Tie, 8 and 8');
  });
});

describe('dealHand: third-card table', () => {
  it('Banker draws or stands exactly per the table for every total and Player third card', () => {
    for (let bankerTotal = 0; bankerTotal <= 7; bankerTotal++) {
      for (let p3 = 0; p3 <= 9; p3++) {
        // Player 2+3 = 5 always draws; Banker gets [bankerTotal, 0] and an Ace as its potential third card.
        const r = dealFromValues([2, 3, p3], [bankerTotal, 0, 1]);
        const shouldDraw = BANKER_DRAWS_ON[bankerTotal].includes(p3);
        expect(r.playerCards, `B${bankerTotal} P3=${p3}`).toHaveLength(3);
        expect(r.bankerCards, `B${bankerTotal} P3=${p3}`).toHaveLength(shouldDraw ? 3 : 2);
        expect(r.playerTotal).toBe((5 + p3) % 10);
        expect(r.bankerTotal).toBe(shouldDraw ? (bankerTotal + 1) % 10 : bankerTotal);
        const stepTypes = types(r.steps);
        expect(stepTypes).toContain('draw');
        expect(r.steps.some((s) => s.type === 'draw' && s.side === 'banker')).toBe(shouldDraw);
        expect(r.steps.some((s) => s.type === 'stand' && s.side === 'banker')).toBe(!shouldDraw);
      }
    }
  });

  it('when the Player stands on 6 or 7, Banker draws on 0–5 and stands on 6–7', () => {
    for (const player of [[3, 3], [3, 4]]) {
      for (let bankerTotal = 0; bankerTotal <= 7; bankerTotal++) {
        const r = dealFromValues(player, [bankerTotal, 0, 1]);
        expect(r.playerCards).toHaveLength(2);
        expect(r.bankerCards).toHaveLength(bankerTotal <= 5 ? 3 : 2);
        expect(r.steps.some((s) => s.type === 'stand' && s.side === 'player')).toBe(true);
      }
    }
  });
});

describe('dealHand: steps and dealer calls', () => {
  it('narrates a six-card hand in order', () => {
    // Player 5 + 10 = 5 draws 2 → 7; Banker 3 + A = 4, P3 = 2 → draws 5 → 9.
    const r = dealFromValues([5, 'T', 2], [3, 'A', 5]);
    const [p0, p1, p2] = r.playerCards;
    const [b0, b1, b2] = r.bankerCards;
    expect(r.steps).toEqual([
      { type: 'deal', to: 'player', card: p0, index: 0, message: 'Card to Player' },
      { type: 'deal', to: 'banker', card: b0, index: 0, message: 'Card to Banker' },
      { type: 'deal', to: 'player', card: p1, index: 1, message: 'Card to Player' },
      { type: 'deal', to: 'banker', card: b1, index: 1, message: 'Card to Banker' },
      { type: 'show', playerTotal: 5, bankerTotal: 4, message: 'Player shows 5, Banker shows 4' },
      { type: 'draw', side: 'player', message: 'Player draws' },
      { type: 'deal', to: 'player', card: p2, index: 2, message: 'Card to Player' },
      { type: 'draw', side: 'banker', message: 'Banker draws' },
      { type: 'deal', to: 'banker', card: b2, index: 2, message: 'Card to Banker' },
      { type: 'result', outcome: 'banker', playerTotal: 7, bankerTotal: 9, message: 'Banker wins, 9 over 7' },
    ]);
  });

  it('calls both stands when nobody draws', () => {
    const r = dealFromValues([3, 4], [2, 4]);
    expect(messages(r.steps).slice(4)).toEqual(['Player shows 7, Banker shows 6', 'Player stands', 'Banker stands', 'Player wins, 7 over 6']);
    expect(r.outcome).toBe('player');
  });

  it('calls Player stands, Banker draws', () => {
    const r = dealFromValues([3, 4], [2, 3, 4]);
    expect(types(r.steps).slice(4)).toEqual(['show', 'stand', 'draw', 'deal', 'result']);
    expect(messages(r.steps).slice(4)).toEqual(['Player shows 7, Banker shows 5', 'Player stands', 'Banker draws', 'Card to Banker', 'Banker wins, 9 over 7']);
  });

  it('calls Player draws, Banker stands', () => {
    const r = dealFromValues([2, 3, 8], [2, 4]);
    expect(types(r.steps).slice(4)).toEqual(['show', 'draw', 'deal', 'stand', 'result']);
    expect(messages(r.steps).at(-1)).toBe('Banker wins, 6 over 3');
    expect(r.bankerWinOn6).toBe(true);
  });

  it('calls a tie', () => {
    const r = dealFromValues([3, 3], [2, 4]);
    expect(messages(r.steps).at(-1)).toBe('Tie, 6 and 6');
    expect(r.outcome).toBe('tie');
    expect(r.bankerWinOn6).toBe(false);
  });
});

describe('dealHand: Dragon 7 and Panda 8', () => {
  it('Dragon 7 = Banker WINS with a three-card 7, announced after the result', () => {
    const r = dealFromValues([2, 3, 1], [1, 2, 4]);
    expect(r.playerTotal).toBe(6);
    expect(r.bankerTotal).toBe(7);
    expect(r.bankerCards).toHaveLength(3);
    expect(r.outcome).toBe('banker');
    expect(r.dragon7).toBe(true);
    expect(r.panda8).toBe(false);
    expect(types(r.steps).slice(-2)).toEqual(['result', 'bonus']);
    expect(r.steps.at(-1)).toEqual({ type: 'bonus', kind: 'dragon7', message: 'Dragon 7!' });
  });

  it('a two-card Banker 7 and a 7–7 tie are not Dragon 7s', () => {
    const twoCard = dealFromValues([2, 3, 'T'], [3, 4]);
    expect(twoCard.outcome).toBe('banker');
    expect(twoCard.bankerTotal).toBe(7);
    expect(twoCard.bankerCards).toHaveLength(2);
    expect(twoCard.dragon7).toBe(false);

    const tie = dealFromValues([3, 4], [1, 2, 4]);
    expect(tie.outcome).toBe('tie');
    expect(tie.bankerCards).toHaveLength(3);
    expect(tie.bankerTotal).toBe(7);
    expect(tie.dragon7).toBe(false);
    expect(types(tie.steps)).not.toContain('bonus');
  });

  it('Panda 8 = Player WINS with a three-card 8', () => {
    const r = dealFromValues([2, 3, 3], [1, 2, 2]);
    expect(r.playerTotal).toBe(8);
    expect(r.playerCards).toHaveLength(3);
    expect(r.outcome).toBe('player');
    expect(r.panda8).toBe(true);
    expect(r.steps.at(-1)).toEqual({ type: 'bonus', kind: 'panda8', message: 'Panda 8!' });
  });

  it('a natural 8 and an 8–8 tie are not Panda 8s', () => {
    const natural = dealFromValues([3, 5], [1, 2]);
    expect(natural.outcome).toBe('player');
    expect(natural.panda8).toBe(false);

    const tie = dealFromValues([2, 3, 3], [1, 2, 5]);
    expect(tie.outcome).toBe('tie');
    expect(tie.playerTotal).toBe(8);
    expect(tie.playerCards).toHaveLength(3);
    expect(tie.panda8).toBe(false);
  });

  it('announces the bonuses only when the table deals them (flags are always set)', () => {
    const noSide: TableRules = { ...cloneRules(DEFAULT_RULES), bankerRule: 'commission', sideBets: { dragon7: false, panda8: false, pairs: false } };
    const dragon = dealFromValues([2, 3, 1], [1, 2, 4], noSide);
    expect(dragon.dragon7).toBe(true);
    expect(types(dragon.steps)).not.toContain('bonus');
    const panda = dealFromValues([2, 3, 3], [1, 2, 2], noSide);
    expect(panda.panda8).toBe(true);
    expect(types(panda.steps)).not.toContain('bonus');

    // EZ tables always call the Dragon 7 (the Banker bet pushes), even with the side bet switched off.
    const ezNoSide: TableRules = { ...cloneRules(DEFAULT_RULES), sideBets: { dragon7: false, panda8: false, pairs: false } };
    expect(dealFromValues([2, 3, 1], [1, 2, 4], ezNoSide).steps.at(-1)?.type).toBe('bonus');
    // Classic table that still deals the Dragon 7 side bet announces it too.
    const classicWithDragon: TableRules = { ...noSide, sideBets: { dragon7: true, panda8: false, pairs: false } };
    expect(dealFromValues([2, 3, 1], [1, 2, 4], classicWithDragon).steps.at(-1)?.type).toBe('bonus');
  });
});

describe('dealHand: pairs', () => {
  it('pairs come from the first two cards, announced before the totals, independent of the outcome', () => {
    const r = dealFromValues(['7', '7', 'T'], ['K', 'K', '9']);
    expect(r.playerPair).toBe(true);
    expect(r.bankerPair).toBe(true);
    expect(r.outcome).toBe('banker');
    expect(types(r.steps).slice(0, 7)).toEqual(['deal', 'deal', 'deal', 'deal', 'bonus', 'bonus', 'show']);
    expect(r.steps[4]).toEqual({ type: 'bonus', kind: 'playerPair', message: 'Player Pair' });
    expect(r.steps[5]).toEqual({ type: 'bonus', kind: 'bankerPair', message: 'Banker Pair' });
  });

  it('a third card never makes a pair; pair calls are skipped when pairs are not dealt', () => {
    const r = dealFromValues([2, 3, 3], [1, 2, 2]);
    expect(r.playerPair).toBe(false);
    expect(r.bankerPair).toBe(false);
    const noPairs: TableRules = { ...cloneRules(DEFAULT_RULES), sideBets: { dragon7: true, panda8: true, pairs: false } };
    const p = dealFromValues(['7', '7', 'T'], ['K', 'K', '9'], noPairs);
    expect(p.playerPair).toBe(true);
    expect(types(p.steps).slice(0, 5)).toEqual(['deal', 'deal', 'deal', 'deal', 'show']);
  });

  it('numeric zeros cycle through T, J, Q, K so they never form an accidental pair', () => {
    expect(dealFromValues([0, 0, 5], [1, 2, 3]).playerPair).toBe(false);
    expect(dealFromValues(['T', 'T', 5], [1, 2, 3]).playerPair).toBe(true);
    expect(dealFromValues(['T', 'K', 5], [1, 2, 3]).playerPair).toBe(false);
    expect(cardsFromValues([0, 0, 0, 0, 0]).map((c) => c.rank)).toEqual(['T', 'J', 'Q', 'K', 'T']);
    expect(cardsFromValues([1, 5, 9], 10)).toEqual([
      { rank: 'A', suit: 'S', id: 10 },
      { rank: '5', suit: 'H', id: 11 },
      { rank: '9', suit: 'D', id: 12 },
    ]);
  });
});

describe('dealHand: cut card', () => {
  it('flags the hand in which the cut card comes out and appends the dealer call', () => {
    // 10 cards, cut card 5 from the end → index 5. Hand 1 uses 0–3 (natural), hand 2 uses 4–9.
    const shoe = scripted([4, 1, 5, 2, 2, 1, 3, 2, 4, 5], 5);
    const first = dealHand(shoe, NO_BURN, 1);
    expect(first.cutCardDrawn).toBe(false);
    expect(types(first.steps)).not.toContain('cutCard');
    const second = dealHand(shoe, NO_BURN, 2);
    expect(second.cutCardDrawn).toBe(true);
    expect(shoe.cutCardReached).toBe(true);
    expect(second.steps.at(-1)).toEqual({ type: 'cutCard', message: MSG_CUT_CARD });
    expect(MSG_CUT_CARD).toBe('Cut card — one more hand, then a new shoe');
  });

  it('is flagged on exactly one hand of a shuffled shoe', () => {
    const shoe = new Shoe(DEFAULT_RULES, createRng(31337), 1);
    const flagged: number[] = [];
    let hand = 0;
    while (shoe.cardsRemaining() >= 6) {
      hand++;
      const reachedBefore = shoe.cutCardReached;
      const r = dealHand(shoe, DEFAULT_RULES, hand);
      if (r.cutCardDrawn) flagged.push(hand);
      expect(r.cutCardDrawn).toBe(!reachedBefore && shoe.cutCardReached);
      expect(types(r.steps).includes('cutCard')).toBe(r.cutCardDrawn);
      const lastCardId = Math.max(...ids(r.playerCards), ...ids(r.bankerCards));
      if (r.cutCardDrawn) expect(lastCardId).toBeGreaterThanOrEqual(shoe.cutCardIndex);
    }
    expect(flagged).toHaveLength(1);
    expect(hand).toBeGreaterThan(flagged[0]);
  });
});

describe('dealHand: fast path', () => {
  it('withSteps:false yields identical hands with empty steps', () => {
    const a = new Shoe(DEFAULT_RULES, createRng(2718), 1);
    const b = new Shoe(DEFAULT_RULES, createRng(2718), 1);
    let n = 0;
    while (a.cardsRemaining() >= 6) {
      n++;
      const withSteps = dealHand(a, DEFAULT_RULES, n);
      const fast = dealHand(b, DEFAULT_RULES, n, { withSteps: false });
      expect(fast.steps).toEqual([]);
      expect(withSteps.steps.length).toBeGreaterThanOrEqual(7);
      const { steps: _s, ...rest } = withSteps;
      const { steps: _f, ...fastRest } = fast;
      expect(fastRest).toEqual(rest);
    }
    expect(n).toBeGreaterThan(60);
  });
});

describe('evaluateHand', () => {
  const cards = (specs: CardSpec[]): Card[] => cardsFromValues(specs);

  it('evaluates totals, outcome and bonuses from the cards alone', () => {
    expect(evaluateHand(cards([4, 5]), cards([1, 2]))).toEqual({
      playerTotal: 9, bankerTotal: 3, outcome: 'player', playerNatural: true, bankerNatural: false,
      dragon7: false, panda8: false, playerPair: false, bankerPair: false, bankerWinOn6: false,
    });
    expect(evaluateHand(cards([2, 3, 1]), cards([1, 2, 4]))).toMatchObject({ outcome: 'banker', bankerTotal: 7, dragon7: true, playerNatural: false, bankerNatural: false });
    expect(evaluateHand(cards([2, 3, 3]), cards([1, 2, 2]))).toMatchObject({ outcome: 'player', playerTotal: 8, panda8: true });
    expect(evaluateHand(cards([3, 4]), cards([1, 2, 4]))).toMatchObject({ outcome: 'tie', dragon7: false });
    expect(evaluateHand(cards(['7', '7', 'T']), cards(['K', 'K', '9']))).toMatchObject({ playerPair: true, bankerPair: true, outcome: 'banker' });
    expect(evaluateHand(cards([2, 3, 8]), cards([2, 4]))).toMatchObject({ outcome: 'banker', bankerTotal: 6, bankerWinOn6: true });
    expect(evaluateHand(cards([3, 5]), cards([2, 6]))).toMatchObject({ outcome: 'tie', playerNatural: true, bankerNatural: true, panda8: false });
  });

  it('agrees with dealHand on dealt hands', () => {
    const shoe = new Shoe(DEFAULT_RULES, createRng(99), 1);
    for (let i = 1; i <= 70; i++) {
      const r: HandResult = dealHand(shoe, DEFAULT_RULES, i);
      const e = evaluateHand(r.playerCards, r.bankerCards);
      expect(e).toEqual({
        playerTotal: r.playerTotal, bankerTotal: r.bankerTotal, outcome: r.outcome,
        playerNatural: r.playerNatural, bankerNatural: r.bankerNatural, dragon7: r.dragon7, panda8: r.panda8,
        playerPair: r.playerPair, bankerPair: r.bankerPair, bankerWinOn6: r.bankerWinOn6,
      });
    }
  });
});

describe('dealFromValues', () => {
  it('rejects hands that cannot be dealt', () => {
    expect(() => dealFromValues([2, 3], [1, 2, 3])).toThrow(/Player needs card 3/);
    expect(() => dealFromValues([3, 4], [1, 2])).toThrow(/Banker needs card 3/);
    expect(() => dealFromValues([3], [1, 2])).toThrow(RangeError);
    expect(() => dealFromValues([3, 10], [1, 2])).toThrow(RangeError);
    expect(() => dealFromValues([3, 'X' as CardSpec], [1, 2])).toThrow(RangeError);
  });

  it('ignores unneeded extra cards and numbers the hand', () => {
    const r = dealFromValues([4, 5, 9, 9], [1, 2, 9], DEFAULT_RULES, 5);
    expect(r.playerCards).toHaveLength(2);
    expect(r.handNumber).toBe(5);
    expect(r.shoeNumber).toBe(0);
    expect(r.cutCardDrawn).toBe(false);
    expect(new Set([...r.playerCards, ...r.bankerCards].map((c) => c.id)).size).toBe(4);
  });
});
