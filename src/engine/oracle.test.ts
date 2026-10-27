/**
 * Independent cross-checks of the engine against a LITERAL transcription of SPEC §2.
 *
 * The oracle below never calls engine logic: it is the rules of the game written out again (dealing order,
 * naturals, the Player rule, the Banker table, the payout table) and the engine is compared against it over the
 * whole decision space (every two-card total × every third card), over real shuffled shoes, and over random
 * layouts. The session fuzz checks the bookkeeping invariants that the SPEC's "stats bookkeeping" requirement
 * implies, through random sequences of public API calls.
 */
import { describe, expect, it } from 'vitest';
import { dealFromValues, dealHand, evaluateHand } from './deal';
import { limitsFor, settleBets } from './settle';
import { Shoe } from './shoe';
import { createRng } from './rng';
import { cardValue } from './cards';
import { cloneRules, DEFAULT_RULES, RULE_PRESETS } from './rules';
import { GameSession } from './session';
import { BET_TYPES } from './types';
import type { BetType, Bets, Card, DealStep, HandResult, Outcome, TableRules } from './types';

// ---------------------------------------------------------------------------------------------------------------
// The oracle: SPEC §2, transcribed.
// ---------------------------------------------------------------------------------------------------------------

/** SPEC §2 step 4: Banker total → the Player third-card VALUES on which Banker draws. */
const BANKER_DRAWS_WHEN_P3_IS: ReadonlyArray<ReadonlySet<number>> = [
  new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), // 0
  new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), // 1
  new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), // 2
  new Set([0, 1, 2, 3, 4, 5, 6, 7, 9]), //    3 (stands on 8)
  new Set([2, 3, 4, 5, 6, 7]), //             4
  new Set([4, 5, 6, 7]), //                   5
  new Set([6, 7]), //                         6
  new Set([]), //                             7
];

interface OracleHand {
  playerValues: number[];
  bankerValues: number[];
  playerTotal: number;
  bankerTotal: number;
  outcome: Outcome;
  playerNatural: boolean;
  bankerNatural: boolean;
  dragon7: boolean;
  panda8: boolean;
  bankerWinOn6: boolean;
  /** Number of cards consumed from `values`. */
  cardsUsed: number;
}

/** Plays one hand from card VALUES in draw order (P, B, P, B, then third cards as the rules require). */
function oracle(values: readonly number[]): OracleHand {
  const playerValues = [values[0], values[2]];
  const bankerValues = [values[1], values[3]];
  let playerTotal = (values[0] + values[2]) % 10;
  let bankerTotal = (values[1] + values[3]) % 10;
  const playerNatural = playerTotal === 8 || playerTotal === 9;
  const bankerNatural = bankerTotal === 8 || bankerTotal === 9;
  let next = 4;

  if (!playerNatural && !bankerNatural) {
    let p3: number | null = null;
    if (playerTotal <= 5) {
      p3 = values[next++];
      playerValues.push(p3);
      playerTotal = (playerTotal + p3) % 10;
    }
    const bankerDraws = p3 === null ? bankerTotal <= 5 : BANKER_DRAWS_WHEN_P3_IS[bankerTotal].has(p3);
    if (bankerDraws) {
      const b3 = values[next++];
      bankerValues.push(b3);
      bankerTotal = (bankerTotal + b3) % 10;
    }
  }

  const outcome: Outcome = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
  return {
    playerValues,
    bankerValues,
    playerTotal,
    bankerTotal,
    outcome,
    playerNatural,
    bankerNatural,
    dragon7: outcome === 'banker' && bankerValues.length === 3 && bankerTotal === 7,
    panda8: outcome === 'player' && playerValues.length === 3 && playerTotal === 8,
    bankerWinOn6: outcome === 'banker' && bankerTotal === 6,
    cardsUsed: next,
  };
}

/** SPEC §2 payout table, transcribed. Returns the net change for one bet. */
function oracleNet(bet: BetType, amount: number, r: HandResult, rules: TableRules): number {
  const cents = (n: number): number => Math.round(n * 100 + 1e-9) / 100;
  switch (bet) {
    case 'player':
      return r.outcome === 'player' ? amount : r.outcome === 'tie' ? 0 : -amount;
    case 'banker':
      if (r.outcome === 'tie') return 0;
      if (r.outcome === 'player') return -amount;
      if (rules.bankerRule === 'ez') return r.dragon7 ? 0 : amount;
      if (rules.bankerRule === 'commission') return cents(amount - cents(amount * rules.commissionRate));
      return r.bankerTotal === 6 ? cents(amount / 2) : amount;
    case 'tie':
      return r.outcome === 'tie' ? cents(amount * rules.tiePays) : -amount;
    case 'dragon7':
      return r.dragon7 ? cents(amount * rules.dragon7Pays) : -amount;
    case 'panda8':
      return r.panda8 ? cents(amount * rules.panda8Pays) : -amount;
    case 'playerPair':
      return r.playerPair ? cents(amount * rules.pairPays) : -amount;
    case 'bankerPair':
      return r.bankerPair ? cents(amount * rules.pairPays) : -amount;
  }
}

const values = (cards: readonly Card[]): number[] => cards.map((c) => cardValue(c.rank));

function compareToOracle(r: HandResult, o: OracleHand, label: string): void {
  expect(values(r.playerCards), label).toEqual(o.playerValues);
  expect(values(r.bankerCards), label).toEqual(o.bankerValues);
  expect(r.playerTotal, label).toBe(o.playerTotal);
  expect(r.bankerTotal, label).toBe(o.bankerTotal);
  expect(r.outcome, label).toBe(o.outcome);
  expect(r.playerNatural, label).toBe(o.playerNatural);
  expect(r.bankerNatural, label).toBe(o.bankerNatural);
  expect(r.dragon7, label).toBe(o.dragon7);
  expect(r.panda8, label).toBe(o.panda8);
  expect(r.bankerWinOn6, label).toBe(o.bankerWinOn6);
  expect(r.playerCards.length + r.bankerCards.length, label).toBe(o.cardsUsed);
}

/** The step list must narrate exactly the hand that was dealt, in the SPEC's order (DEFAULT_RULES: every call made). */
function checkSteps(r: HandResult, label: string): void {
  const steps = r.steps;
  const t = (s: DealStep): string => s.type;
  const expected: string[] = ['deal', 'deal', 'deal', 'deal'];
  if (r.playerPair) expected.push('bonus');
  if (r.bankerPair) expected.push('bonus');
  expected.push('show');
  if (r.playerNatural || r.bankerNatural) {
    expected.push('natural');
  } else {
    if (r.playerCards.length === 3) expected.push('draw', 'deal');
    else expected.push('stand');
    if (r.bankerCards.length === 3) expected.push('draw', 'deal');
    else expected.push('stand');
  }
  expected.push('result');
  if (r.dragon7) expected.push('bonus');
  if (r.panda8) expected.push('bonus');
  if (r.cutCardDrawn) expected.push('cutCard');
  expect(steps.map(t), label).toEqual(expected);

  // Deal steps carry the right cards, sides and indices, in casino order.
  const deals = steps.filter((s): s is Extract<DealStep, { type: 'deal' }> => s.type === 'deal');
  const order: Array<[Card, 'player' | 'banker', 0 | 1 | 2]> = [
    [r.playerCards[0], 'player', 0],
    [r.bankerCards[0], 'banker', 0],
    [r.playerCards[1], 'player', 1],
    [r.bankerCards[1], 'banker', 1],
  ];
  if (r.playerCards.length === 3) order.push([r.playerCards[2], 'player', 2]);
  if (r.bankerCards.length === 3) order.push([r.bankerCards[2], 'banker', 2]);
  expect(deals.map((d) => [d.card, d.to, d.index]), label).toEqual(order);
  for (const d of deals) expect(d.message).toBe(d.to === 'player' ? 'Card to Player' : 'Card to Banker');

  const show = steps.find((s) => s.type === 'show');
  const twoCardP = (values(r.playerCards)[0] + values(r.playerCards)[1]) % 10;
  const twoCardB = (values(r.bankerCards)[0] + values(r.bankerCards)[1]) % 10;
  expect(show, label).toEqual({ type: 'show', playerTotal: twoCardP, bankerTotal: twoCardB, message: `Player shows ${twoCardP}, Banker shows ${twoCardB}` });

  const result = steps.find((s) => s.type === 'result');
  const msg =
    r.outcome === 'banker'
      ? `Banker wins, ${r.bankerTotal} over ${r.playerTotal}`
      : r.outcome === 'player'
        ? `Player wins, ${r.playerTotal} over ${r.bankerTotal}`
        : `Tie, ${r.playerTotal} and ${r.bankerTotal}`;
  expect(result, label).toEqual({ type: 'result', outcome: r.outcome, playerTotal: r.playerTotal, bankerTotal: r.bankerTotal, message: msg });

  for (const s of steps) {
    if (s.type === 'draw' || s.type === 'stand') {
      const cards = s.side === 'player' ? r.playerCards : r.bankerCards;
      expect(cards.length, `${label} ${s.type} ${s.side}`).toBe(s.type === 'draw' ? 3 : 2);
      expect(s.message).toBe(`${s.side === 'player' ? 'Player' : 'Banker'} ${s.type === 'draw' ? 'draws' : 'stands'}`);
    }
    if (s.type === 'natural') {
      expect(s.side).toBe(r.playerNatural && r.bankerNatural ? 'both' : r.playerNatural ? 'player' : 'banker');
    }
    if (s.type === 'bonus') {
      const flag = { dragon7: r.dragon7, panda8: r.panda8, playerPair: r.playerPair, bankerPair: r.bankerPair }[s.kind];
      expect(flag, `${label} bonus ${s.kind}`).toBe(true);
      expect(s.message).toBe({ dragon7: 'Dragon 7!', panda8: 'Panda 8!', playerPair: 'Player Pair', bankerPair: 'Banker Pair' }[s.kind]);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

describe('oracle: the whole third-card decision space', () => {
  it('every two-card total × every Player third card × every Banker third card, two ways of making each total', () => {
    let hands = 0;
    const seen = { dragon7: 0, panda8: 0, tie: 0, natural: 0, sixCards: 0, fourCards: 0 };
    for (let pTotal = 0; pTotal <= 9; pTotal++) {
      for (let bTotal = 0; bTotal <= 9; bTotal++) {
        for (let p3 = 0; p3 <= 9; p3++) {
          for (let b3 = 0; b3 <= 9; b3++) {
            // Two decompositions of the same totals: [t, 0] and the wrapping [9, t+1 mod 10].
            const splits: Array<[number, number]>[] = [
              [[pTotal, 0], [bTotal, 0]],
              [[9, (pTotal + 1) % 10], [9, (bTotal + 1) % 10]],
            ];
            for (const [[pa, pb], [ba, bb]] of splits) {
              const r = dealFromValues([pa, pb, p3], [ba, bb, b3]);
              const o = oracle([pa, ba, pb, bb, ...(o3(pa, pb, ba, bb, p3, b3))]);
              const label = `P[${pa},${pb}]+${p3} B[${ba},${bb}]+${b3}`;
              compareToOracle(r, o, label);
              // Pairs: equal non-zero values share a rank; zeros are dealt as T/J/Q/K in turn.
              expect(r.playerPair, label).toBe(pa === pb && pa !== 0);
              expect(r.bankerPair, label).toBe(ba === bb && ba !== 0);
              expect(r.cutCardDrawn).toBe(false);
              checkSteps(r, label);
              hands++;
              if (r.dragon7) seen.dragon7++;
              if (r.panda8) seen.panda8++;
              if (r.outcome === 'tie') seen.tie++;
              if (r.playerNatural || r.bankerNatural) seen.natural++;
              if (r.playerCards.length + r.bankerCards.length === 6) seen.sixCards++;
              if (r.playerCards.length + r.bankerCards.length === 4) seen.fourCards++;
            }
          }
        }
      }
    }
    expect(hands).toBe(20_000);
    // The enumeration really exercised every branch.
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(0);
  });

  /** Draw-order values after the first four: the engine's third cards come in Player-then-Banker order. */
  function o3(pa: number, pb: number, ba: number, bb: number, p3: number, b3: number): number[] {
    const pTotal = (pa + pb) % 10;
    const bTotal = (ba + bb) % 10;
    if (pTotal >= 8 || bTotal >= 8) return [];
    const out: number[] = [];
    if (pTotal <= 5) out.push(p3);
    out.push(b3); // consumed only if Banker draws; the oracle reads what it needs
    return out;
  }

  it('evaluateHand agrees with the oracle on every dealt hand', () => {
    for (let pTotal = 0; pTotal <= 9; pTotal++) {
      for (let bTotal = 0; bTotal <= 9; bTotal++) {
        for (let p3 = 0; p3 <= 9; p3++) {
          for (let b3 = 0; b3 <= 9; b3++) {
            const r = dealFromValues([pTotal, 0, p3], [bTotal, 0, b3]);
            const e = evaluateHand(r.playerCards, r.bankerCards);
            expect(e).toEqual({
              playerTotal: r.playerTotal, bankerTotal: r.bankerTotal, outcome: r.outcome,
              playerNatural: r.playerNatural, bankerNatural: r.bankerNatural, dragon7: r.dragon7, panda8: r.panda8,
              playerPair: r.playerPair, bankerPair: r.bankerPair, bankerWinOn6: r.bankerWinOn6,
            });
          }
        }
      }
    }
  });
});

describe('oracle: real shoes', () => {
  it('dealHand draws consecutive cards from the shoe and matches the oracle, hand after hand, shoe after shoe', () => {
    const rules = DEFAULT_RULES;
    let hands = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const rng = createRng(seed);
      const shoe = new Shoe(rules, rng, seed);
      const burned = shoe.cardsDealt();
      expect(burned).toBe(1 + shoe.burnedCards.length);
      let n = 0;
      let lastHandNext = false;
      let flagged = 0;
      for (;;) {
        const start = shoe.cardsDealt();
        n++;
        const r = dealHand(shoe, rules, n, { withSteps: n % 2 === 0 });
        hands++;
        // Casino order: P0 B0 P1 B1 (P2) (B2) are the next cards out of the shoe, in that order.
        const dealt: Card[] = [r.playerCards[0], r.bankerCards[0], r.playerCards[1], r.bankerCards[1]];
        if (r.playerCards.length === 3) dealt.push(r.playerCards[2]);
        if (r.bankerCards.length === 3) dealt.push(r.bankerCards[2]);
        expect(dealt.map((c) => c.id)).toEqual(dealt.map((_, i) => start + i));
        expect(shoe.cardsDealt()).toBe(start + dealt.length);
        const o = oracle(values(dealt));
        compareToOracle(r, o, `seed ${seed} hand ${n}`);
        expect(r.playerPair).toBe(r.playerCards[0].rank === r.playerCards[1].rank);
        expect(r.bankerPair).toBe(r.bankerCards[0].rank === r.bankerCards[1].rank);
        expect(r.handNumber).toBe(n);
        expect(r.shoeNumber).toBe(seed);
        if (n % 2 === 0) checkSteps(r, `seed ${seed} hand ${n}`);
        else expect(r.steps).toEqual([]);

        if (r.cutCardDrawn) {
          flagged++;
          // The cut card came out during THIS hand: the card behind it (cutCardIndex) is one of this hand's cards.
          expect(dealt.map((c) => c.id)).toContain(shoe.cutCardIndex);
        }
        if (lastHandNext) break;
        if (r.cutCardDrawn) lastHandNext = true;
        expect(shoe.cardsRemaining()).toBeGreaterThanOrEqual(6);
      }
      expect(flagged).toBe(1);
    }
    expect(hands).toBeGreaterThan(150 * 60);
  });

  it('with the cut card at the minimum depth the final hand always fits (SPEC: one more hand, then a new shoe)', () => {
    for (const cutCardFromEnd of [12, 13, 14, 20]) {
      const rules: TableRules = { ...cloneRules(DEFAULT_RULES), cutCardFromEnd };
      let minRemainingBeforeFinal = Number.POSITIVE_INFINITY;
      for (let seed = 1; seed <= 400; seed++) {
        const shoe = new Shoe(rules, createRng(seed * 7919), 1);
        let n = 0;
        for (;;) {
          const r = dealHand(shoe, rules, ++n, { withSteps: false });
          if (r.cutCardDrawn) {
            minRemainingBeforeFinal = Math.min(minRemainingBeforeFinal, shoe.cardsRemaining());
            expect(shoe.cardsRemaining()).toBeGreaterThanOrEqual(6);
            expect(() => dealHand(shoe, rules, n + 1, { withSteps: false })).not.toThrow();
            break;
          }
        }
      }
      // At 12 from the end the guarantee is tight: some shoe leaves exactly 6 cards for the final hand.
      if (cutCardFromEnd === 12) expect(minRemainingBeforeFinal).toBe(6);
    }
  });
});

describe('oracle: settlement', () => {
  const variants: Array<[string, TableRules]> = [
    ['ez', DEFAULT_RULES],
    ['commission', RULE_PRESETS.commission.rules],
    ['super6', RULE_PRESETS.super6.rules],
    ['custom', { ...cloneRules(DEFAULT_RULES), bankerRule: 'commission', commissionRate: 0.04, tiePays: 9, dragon7Pays: 45, panda8Pays: 30, pairPays: 12 }],
  ];

  function sampleHands(): HandResult[] {
    const shoe = new Shoe(DEFAULT_RULES, createRng(4242), 1);
    const out: HandResult[] = [];
    while (shoe.cardsRemaining() >= 6) out.push(dealHand(shoe, DEFAULT_RULES, out.length + 1, { withSteps: false }));
    // Make sure the rare events are in the sample.
    out.push(dealFromValues([2, 3, 1], [1, 2, 4])); // Dragon 7
    out.push(dealFromValues([2, 3, 3], [1, 2, 2])); // Panda 8
    out.push(dealFromValues([3, 4], [1, 2, 4])); // 7–7 tie with a three-card Banker 7
    out.push(dealFromValues([2, 3, 3], [1, 2, 5])); // 8–8 tie with a three-card Player 8
    out.push(dealFromValues([2, 3, 8], [2, 4])); // Banker wins with 6
    out.push(dealFromValues([3, 3], [2, 4])); // 6–6 tie
    out.push(dealFromValues(['7', '7', 'T'], ['K', 'K', '9'])); // both pairs
    return out;
  }

  it('settleBets matches the SPEC payout table on random layouts for every Banker rule', () => {
    const hands = sampleHands();
    const rng = createRng(99);
    const amounts = [1, 5, 7, 10, 12.5, 15, 25, 33, 100, 0.1, 999.99];
    let dragonPushes = 0;
    let halfPays = 0;
    let commissions = 0;
    for (const [name, rules] of variants) {
      for (const r of hands) {
        const bets: Bets = {};
        for (const bet of BET_TYPES) if (rng.next() < 0.6) bets[bet] = amounts[rng.nextInt(amounts.length)];
        const s = settleBets(bets, r, rules);
        let net = 0;
        let commission = 0;
        let wagered = 0;
        const expectedOrder: BetType[] = [];
        for (const bet of BET_TYPES) {
          const amount = bets[bet];
          if (amount === undefined) continue;
          expectedOrder.push(bet);
          const want = oracleNet(bet, amount, r, rules);
          const got = s.settlements.find((x) => x.bet === bet);
          expect(got, `${name} ${bet}`).toBeDefined();
          expect(got!.amount).toBe(amount);
          expect(got!.net, `${name} ${bet} on ${r.outcome} ${r.playerTotal}-${r.bankerTotal}`).toBeCloseTo(want, 9);
          expect(got!.result).toBe(want > 0 ? 'win' : want < 0 ? 'lose' : 'push');
          if (bet === 'banker' && rules.bankerRule === 'commission' && r.outcome === 'banker') {
            expect(got!.commission).toBeCloseTo(Math.round(amount * rules.commissionRate * 100 + 1e-9) / 100, 9);
            commissions++;
          } else {
            expect(got!.commission).toBe(0);
          }
          if (bet === 'banker' && rules.bankerRule === 'ez' && r.dragon7) dragonPushes++;
          if (bet === 'banker' && rules.bankerRule === 'super6' && r.bankerWinOn6) halfPays++;
          net += want;
          commission += got!.commission;
          wagered += amount;
        }
        expect(s.settlements.map((x) => x.bet)).toEqual(expectedOrder);
        expect(s.net).toBeCloseTo(net, 9);
        expect(s.commission).toBeCloseTo(commission, 9);
        expect(s.totalWagered).toBeCloseTo(wagered, 9);
      }
    }
    expect(dragonPushes).toBeGreaterThan(0);
    expect(halfPays).toBeGreaterThan(0);
    expect(commissions).toBeGreaterThan(0);
  });
});

describe('oracle: GameSession bookkeeping under random play', () => {
  it('every invariant holds through thousands of random actions, cut cards and new shoes', () => {
    const rules: TableRules = { ...cloneRules(RULE_PRESETS.commission.rules), sideBets: { dragon7: true, panda8: true, pairs: true } };
    const s = new GameSession({ seed: 777, bankroll: 200_000, rules });
    const rng = createRng(31);
    const chips = rules.chipDenominations;
    let deals = 0;
    let newShoes = 0;
    let cutHands = 0;
    let expectedNet = 0;
    let expectedWagered = 0;
    let expectedCommission = 0;
    const byBet: Record<BetType, { count: number; wagered: number; net: number; wins: number; losses: number; pushes: number }> = {} as never;
    for (const b of BET_TYPES) byBet[b] = { count: 0, wagered: 0, net: 0, wins: 0, losses: 0, pushes: 0 };
    let peak = 200_000;
    let low = 200_000;
    let maxDrawdown = 0;
    let streak: { outcome: Outcome | null; length: number } = { outcome: null, length: 0 };
    let longestP = 0;
    let longestB = 0;

    for (let step = 0; step < 6000; step++) {
      const state = s.getState();
      const action = rng.nextInt(10);
      if (action < 5) {
        const bet = BET_TYPES[rng.nextInt(BET_TYPES.length)];
        const amount = chips[rng.nextInt(chips.length)];
        const res = s.placeBet(bet, amount);
        const after = s.getState();
        if (res.ok) {
          expect(after.bets[bet]).toBeCloseTo((state.bets[bet] ?? 0) + amount, 9);
          expect(sum(after.bets)).toBeLessThanOrEqual(after.bankroll + 1e-9);
        } else {
          expect(after).toBe(state);
          expect(res.reason).toBeTruthy();
        }
      } else if (action === 5) {
        s.undoLastChip();
      } else if (action === 6) {
        s.removeChip(BET_TYPES[rng.nextInt(BET_TYPES.length)]);
      } else if (action === 7 && rng.next() < 0.3) {
        s.clearBets();
      } else if (action === 7) {
        s.rebet();
      } else {
        const can = s.canDeal();
        if (!can.ok) {
          expect(() => s.deal()).toThrow(/Cannot deal/);
          expect(s.getState()).toBe(state);
          // Random chips rarely make a legal layout: build one (a few bets at or above their minimums).
          s.clearBets();
          const picks = BET_TYPES.filter(() => rng.next() < 0.5);
          if (picks.length === 0) picks.push('banker');
          for (const bet of picks) s.placeBet(bet, limitsFor(bet, rules).min * (1 + rng.nextInt(3)));
          expect(s.canDeal()).toEqual({ ok: true });
        }
        const before = s.getState();
        const layout = { ...before.bets };
        const wasLastHand = before.shoe.lastHandNext;
        const o = s.deal();
        deals++;
        const after = s.getState();
        const r = o.result;
        // Settlement is the SPEC table; bankroll moves by exactly the net.
        for (const st of o.settlement.settlements) {
          expect(st.net).toBeCloseTo(oracleNet(st.bet, st.amount, r, rules), 9);
          byBet[st.bet].count++;
          byBet[st.bet].wagered += st.amount;
          byBet[st.bet].net += st.net;
          byBet[st.bet][st.result === 'win' ? 'wins' : st.result === 'lose' ? 'losses' : 'pushes']++;
        }
        expectedNet += o.settlement.net;
        expectedWagered += o.settlement.totalWagered;
        expectedCommission += o.settlement.commission;
        expect(after.bankroll).toBeCloseTo(before.bankroll + o.settlement.net, 9);
        expect(after.bankroll).toBeGreaterThanOrEqual(0);
        expect(after.bets).toEqual({});
        expect(after.lastBets).toEqual(layout);
        expect(s.getChipStack()).toEqual([]);
        expect(after.lastHand).toEqual({ result: r, settlement: o.settlement });
        expect(after.totalHands).toBe(before.totalHands + 1);
        expect(after.stats.handsPlayed).toBe(after.totalHands);
        expect(after.stats.net).toBeCloseTo(expectedNet, 6);
        expect(after.stats.totalWagered).toBeCloseTo(expectedWagered, 6);
        expect(after.stats.commissionPaid).toBeCloseTo(expectedCommission, 6);
        expect(after.bankroll).toBeCloseTo(after.stats.startingBankroll + after.stats.net, 6);
        peak = Math.max(peak, after.bankroll);
        low = Math.min(low, after.bankroll);
        maxDrawdown = Math.max(maxDrawdown, peak - after.bankroll);
        expect(after.stats.peakBankroll).toBeCloseTo(peak, 6);
        expect(after.stats.lowBankroll).toBeCloseTo(low, 6);
        expect(after.stats.maxDrawdown).toBeCloseTo(maxDrawdown, 6);
        for (const b of BET_TYPES) {
          expect(after.stats.byBet[b].count).toBe(byBet[b].count);
          expect(after.stats.byBet[b].wagered).toBeCloseTo(byBet[b].wagered, 6);
          expect(after.stats.byBet[b].net).toBeCloseTo(byBet[b].net, 6);
          expect(after.stats.byBet[b].wins).toBe(byBet[b].wins);
          expect(after.stats.byBet[b].losses).toBe(byBet[b].losses);
          expect(after.stats.byBet[b].pushes).toBe(byBet[b].pushes);
        }
        // Streaks: big-road convention (a tie never breaks a Player/Banker streak).
        if (r.outcome === 'tie') {
          if (streak.outcome === null || streak.outcome === 'tie') streak = { outcome: 'tie', length: streak.length + 1 };
        } else {
          streak = streak.outcome === r.outcome ? { outcome: r.outcome, length: streak.length + 1 } : { outcome: r.outcome, length: 1 };
          if (r.outcome === 'player') longestP = Math.max(longestP, streak.length);
          else longestB = Math.max(longestB, streak.length);
        }
        expect(after.stats.currentStreak).toEqual(streak);
        expect(after.stats.longestPlayerStreak).toBe(longestP);
        expect(after.stats.longestBankerStreak).toBe(longestB);

        // Shoe bookkeeping: cut card → exactly one more hand → new shoe.
        if (wasLastHand) {
          expect(o.newShoeStarted).toBe(true);
          newShoes++;
          expect(r.cutCardDrawn).toBe(false);
          expect(after.shoe.shoeNumber).toBe(before.shoe.shoeNumber + 1);
          expect(after.shoe.handsDealt).toBe(0);
          expect(after.shoe.lastHandNext).toBe(false);
          expect(after.shoe.cutCardReached).toBe(false);
          expect(after.shoeHistory).toEqual([]);
          expect(after.seenCards).toEqual([after.shoe.exposedBurnCard]);
          expect(after.stats.shoesPlayed).toBe(before.stats.shoesPlayed + 1);
        } else {
          expect(o.newShoeStarted).toBe(false);
          expect(after.shoe.shoeNumber).toBe(before.shoe.shoeNumber);
          expect(after.shoe.handsDealt).toBe(before.shoe.handsDealt + 1);
          expect(after.shoeHistory).toEqual([...before.shoeHistory, r]);
          expect(r.handNumber).toBe(after.shoeHistory.length);
          expect(after.shoe.lastHandNext).toBe(r.cutCardDrawn);
          expect(after.shoe.cutCardReached).toBe(before.shoe.cutCardReached || r.cutCardDrawn);
          if (r.cutCardDrawn) cutHands++;
          expect(before.shoe.cutCardReached && r.cutCardDrawn).toBe(false);
          // Seen cards: exposed burn card first, then every card in dealing order; ids strictly increasing.
          const dealt: Card[] = [r.playerCards[0], r.bankerCards[0], r.playerCards[1], r.bankerCards[1]];
          if (r.playerCards.length === 3) dealt.push(r.playerCards[2]);
          if (r.bankerCards.length === 3) dealt.push(r.bankerCards[2]);
          expect(after.seenCards).toEqual([...before.seenCards, ...dealt]);
          expect(after.seenCards[0]).toBe(after.shoe.exposedBurnCard);
          for (let i = 1; i < after.seenCards.length; i++) expect(after.seenCards[i].id).toBeGreaterThan(after.seenCards[i - 1].id);
          expect(after.shoe.cardsDealt).toBe(after.shoe.burnedCount + after.seenCards.length);
          expect(after.shoe.cardsRemaining).toBe(after.shoe.totalCards - after.shoe.cardsDealt);
        }
        expect(after.shoeHistory.filter((h) => h.cutCardDrawn).length).toBeLessThanOrEqual(1);
      }

      // Chip stack ⇔ layout, every time.
      const now = s.getState();
      const stack = s.getChipStack();
      const fromStack: Bets = {};
      for (const chip of stack) fromStack[chip.bet] = Math.round(((fromStack[chip.bet] ?? 0) + chip.amount) * 100) / 100;
      expect(now.bets).toEqual(fromStack);
      for (const b of BET_TYPES) expect(s.getChips(b)).toEqual(stack.filter((c) => c.bet === b).map((c) => c.amount));
      expect(sum(now.bets)).toBeLessThanOrEqual(now.bankroll + 1e-9);
    }
    expect(deals).toBeGreaterThan(900);
    expect(newShoes).toBeGreaterThanOrEqual(8);
    expect(cutHands).toBe(newShoes + (s.getState().shoe.lastHandNext ? 1 : 0));
    expect(s.getState().stats.shoesPlayed).toBe(1 + newShoes);
  });

  it('old snapshots never change after later mutations', () => {
    const s = new GameSession({ seed: 8, bankroll: 5000 });
    s.placeBet('player', 10);
    s.placeBet('dragon7', 5);
    const snapshot = s.getState();
    const copy = structuredClone(snapshot);
    for (let i = 0; i < 90; i++) {
      s.placeBet('banker', 10);
      s.deal();
      s.rebet();
    }
    s.newShoe();
    s.setBankroll(100);
    s.clearBets();
    expect(snapshot).toEqual(copy);
  });
});

function sum(bets: Bets): number {
  let total = 0;
  for (const bet of BET_TYPES) total += bets[bet] ?? 0;
  return total;
}
