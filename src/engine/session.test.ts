import { describe, expect, it } from 'vitest';
import { GameSession } from './session';
import { cloneRules, DEFAULT_RULES, RULE_PRESETS, applyTableLevel } from './rules';
import { BET_TYPES } from './types';
import type { BetType, HandResult, SessionState, TableRules } from './types';

const RICH = 1_000_000;

function playHands(session: GameSession, hands: number, bets: Partial<Record<BetType, number>> = { player: 10 }) {
  const outcomes = [];
  for (let i = 0; i < hands; i++) {
    for (const [bet, amount] of Object.entries(bets) as [BetType, number][]) {
      const placed = session.placeBet(bet, amount);
      expect(placed.ok, placed.reason).toBe(true);
    }
    outcomes.push(session.deal());
  }
  return outcomes;
}

describe('GameSession: initial state', () => {
  it('starts with the defaults and a fresh shoe', () => {
    const s = new GameSession({ seed: 1 });
    const state = s.getState();
    expect(state.rules).toEqual(DEFAULT_RULES);
    expect(state.rules).not.toBe(DEFAULT_RULES);
    expect(state.bankroll).toBe(1000);
    expect(state.bets).toEqual({});
    expect(state.lastBets).toEqual({});
    expect(state.shoe.shoeNumber).toBe(1);
    expect(state.shoe.totalCards).toBe(416);
    expect(state.shoe.handsDealt).toBe(0);
    expect(state.shoe.lastHandNext).toBe(false);
    expect(state.shoe.exposedBurnCard).not.toBeNull();
    expect(state.shoe.cardsDealt).toBe(1 + state.shoe.burnedCount);
    expect(state.seenCards).toEqual([state.shoe.exposedBurnCard]);
    expect(state.shoeHistory).toEqual([]);
    expect(state.totalHands).toBe(0);
    expect(state.lastHand).toBeNull();
    expect(state.seed).toBe(1);
    expect(state.stats.handsPlayed).toBe(0);
    expect(state.stats.shoesPlayed).toBe(1);
    expect(state.stats.startingBankroll).toBe(1000);
    expect(state.stats.peakBankroll).toBe(1000);
    expect(state.stats.lowBankroll).toBe(1000);
    expect(state.stats.currentStreak).toEqual({ outcome: null, length: 0 });
    for (const bet of BET_TYPES) expect(state.stats.byBet[bet]).toEqual({ count: 0, wagered: 0, net: 0, wins: 0, losses: 0, pushes: 0 });
  });

  it('accepts custom options and rejects invalid rules or bankroll', () => {
    const rules: TableRules = { ...cloneRules(DEFAULT_RULES), decks: 6, burnProcedure: false };
    const s = new GameSession({ rules, bankroll: 250, seed: 9 });
    expect(s.getState().rules.decks).toBe(6);
    expect(s.getState().shoe.totalCards).toBe(312);
    expect(s.getState().shoe.exposedBurnCard).toBeNull();
    expect(s.getState().seenCards).toEqual([]);
    expect(s.getState().bankroll).toBe(250);
    expect(() => new GameSession({ rules: { ...rules, cutCardFromEnd: 2 } })).toThrow(/Cut card/);
    expect(() => new GameSession({ bankroll: -1 })).toThrow(RangeError);
    expect(() => new GameSession({ bankroll: Number.NaN })).toThrow(RangeError);
    const random = new GameSession();
    expect(Number.isInteger(random.getState().seed)).toBe(true);
  });
});

describe('GameSession: placing chips', () => {
  it('adds to the spot, keeps a chip stack and returns new state objects', () => {
    const s = new GameSession({ seed: 1 });
    const before = s.getState();
    expect(s.placeBet('player', 25)).toEqual({ ok: true });
    expect(s.placeBet('player', 5)).toEqual({ ok: true });
    expect(s.placeBet('banker', 100)).toEqual({ ok: true });
    const after = s.getState();
    expect(after).not.toBe(before);
    expect(before.bets).toEqual({});
    expect(after.bets).toEqual({ player: 30, banker: 100 });
    expect(s.getChips('player')).toEqual([25, 5]);
    expect(s.getChips('banker')).toEqual([100]);
    expect(s.getChipStack()).toEqual([{ bet: 'player', amount: 25 }, { bet: 'player', amount: 5 }, { bet: 'banker', amount: 100 }]);
  });

  it('enforces the table maximum on placement', () => {
    const s = new GameSession({ seed: 1, bankroll: RICH });
    expect(s.placeBet('player', 5000).ok).toBe(true);
    expect(s.placeBet('player', 1)).toEqual({ ok: false, reason: 'Player bet cannot exceed the table maximum of $5,000' });
    expect(s.placeBet('tie', 500).ok).toBe(true);
    expect(s.placeBet('tie', 5).reason).toMatch(/maximum of \$500/);
    expect(s.placeBet('dragon7', 501).reason).toMatch(/maximum of \$500/);
    expect(s.getState().bets).toEqual({ player: 5000, tie: 500 });
  });

  it('refuses bets the table does not offer and non-positive amounts', () => {
    const s = new GameSession({ seed: 1, rules: RULE_PRESETS.commission.rules });
    expect(s.placeBet('panda8', 5)).toEqual({ ok: false, reason: 'Panda 8 is not offered at this table' });
    expect(s.placeBet('dragon7', 5).ok).toBe(false);
    expect(s.placeBet('playerPair', 5).ok).toBe(true);
    expect(s.placeBet('player', 0)).toEqual({ ok: false, reason: 'Bet amount must be a positive number' });
    expect(s.placeBet('player', -10).ok).toBe(false);
    expect(s.placeBet('player', Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it('never lets the layout exceed the bankroll', () => {
    const s = new GameSession({ seed: 1, bankroll: 100 });
    expect(s.placeBet('player', 60).ok).toBe(true);
    expect(s.placeBet('banker', 50)).toEqual({ ok: false, reason: 'Not enough bankroll: only $40 left to bet' });
    expect(s.placeBet('banker', 40).ok).toBe(true);
    expect(s.placeBet('tie', 1)).toEqual({ ok: false, reason: 'Not enough bankroll' });
    expect(s.getState().bets).toEqual({ player: 60, banker: 40 });
  });

  it('removeChip / undoLastChip / clearBets work on the chip stack', () => {
    const s = new GameSession({ seed: 1 });
    s.placeBet('player', 25);
    s.placeBet('player', 5);
    s.placeBet('banker', 100);
    s.placeBet('tie', 5);
    s.undoLastChip();
    expect(s.getState().bets).toEqual({ player: 30, banker: 100 });
    s.removeChip('player');
    expect(s.getState().bets).toEqual({ player: 25, banker: 100 });
    expect(s.getChips('player')).toEqual([25]);
    const unchanged = s.getState();
    s.removeChip('dragon7');
    expect(s.getState()).toBe(unchanged);
    s.removeChip('player');
    expect(s.getState().bets).toEqual({ banker: 100 });
    expect('player' in s.getState().bets).toBe(false);
    s.clearBets();
    expect(s.getState().bets).toEqual({});
    expect(s.getChipStack()).toEqual([]);
    const empty = s.getState();
    s.undoLastChip();
    s.clearBets();
    expect(s.getState()).toBe(empty);
  });
});

describe('GameSession: dealing', () => {
  it('canDeal needs a bet at or above the minimum; deal() refuses otherwise', () => {
    const s = new GameSession({ seed: 1 });
    expect(s.canDeal()).toEqual({ ok: false, reason: 'Place a bet to deal' });
    expect(() => s.deal()).toThrow(/Place a bet to deal/);
    s.placeBet('player', 5);
    expect(s.canDeal()).toEqual({ ok: false, reason: 'Player bet of $5 is below the table minimum of $10' });
    s.placeBet('player', 5);
    expect(s.canDeal()).toEqual({ ok: true });
    s.placeBet('tie', 1);
    expect(s.canDeal().ok).toBe(false);
  });

  it('deals, settles, books the hand and moves the layout to lastBets', () => {
    const s = new GameSession({ seed: 42 });
    const bets = { player: 10, banker: 20, tie: 5, dragon7: 5, panda8: 5, playerPair: 5, bankerPair: 5 } as const;
    for (const [bet, amount] of Object.entries(bets) as [BetType, number][]) expect(s.placeBet(bet, amount).ok).toBe(true);
    const outcome = s.deal();
    const state = s.getState();
    expect(outcome.result.handNumber).toBe(1);
    expect(outcome.result.shoeNumber).toBe(1);
    expect(outcome.result.steps.length).toBeGreaterThan(0);
    expect(outcome.newShoeStarted).toBe(false);
    expect(outcome.settlement.totalWagered).toBe(55);
    expect(state.bankroll).toBe(1000 + outcome.settlement.net);
    expect(state.bets).toEqual({});
    expect(state.lastBets).toEqual(bets);
    expect(s.getChipStack()).toEqual([]);
    expect(state.shoeHistory).toEqual([outcome.result]);
    expect(state.totalHands).toBe(1);
    expect(state.lastHand).toEqual({ result: outcome.result, settlement: outcome.settlement });
    expect(state.shoe.handsDealt).toBe(1);
    expect(state.shoe.cardsDealt).toBe(1 + state.shoe.burnedCount + outcome.result.playerCards.length + outcome.result.bankerCards.length);
    expect(state.seenCards).toHaveLength(1 + outcome.result.playerCards.length + outcome.result.bankerCards.length);
    const { playerCards: p, bankerCards: b } = outcome.result;
    expect(state.seenCards.slice(1, 5)).toEqual([p[0], b[0], p[1], b[1]]);
    expect(state.stats.handsPlayed).toBe(1);
    expect(state.stats.handsBet).toBe(1);
    expect(state.stats.totalWagered).toBe(55);
    expect(state.stats.net).toBe(outcome.settlement.net);
    for (const st of outcome.settlement.settlements) {
      expect(state.stats.byBet[st.bet]).toEqual({
        count: 1, wagered: st.amount, net: st.net,
        wins: st.result === 'win' ? 1 : 0, losses: st.result === 'lose' ? 1 : 0, pushes: st.result === 'push' ? 1 : 0,
      });
    }
    expect(state.stats.currentStreak).toEqual({ outcome: outcome.result.outcome, length: 1 });
  });

  it('rebet restores the previous layout and chip stack when allowed and affordable', () => {
    const s = new GameSession({ seed: 7, bankroll: 100 });
    expect(s.rebet()).toEqual({ ok: false, reason: 'No previous bets to repeat' });
    s.placeBet('player', 25);
    s.placeBet('player', 25);
    s.placeBet('tie', 5);
    s.deal();
    expect(s.rebet()).toEqual({ ok: true });
    expect(s.getState().bets).toEqual({ player: 50, tie: 5 });
    expect(s.getChips('player')).toEqual([25, 25]);
    expect(s.getChips('tie')).toEqual([5]);
    s.clearBets();
    s.setBankroll(40);
    expect(s.rebet()).toEqual({ ok: false, reason: 'Not enough bankroll to repeat $55 in bets' });
    s.setBankroll(1000);
    s.setRules({ ...cloneRules(DEFAULT_RULES), limits: { ...DEFAULT_RULES.limits, main: { min: 10, max: 40 } } });
    expect(s.rebet()).toEqual({ ok: false, reason: 'Player bet cannot exceed the table maximum of $40' });
    // Rebet replaces whatever is on the layout.
    s.setRules(DEFAULT_RULES);
    s.placeBet('banker', 100);
    expect(s.rebet().ok).toBe(true);
    expect(s.getState().bets).toEqual({ player: 50, tie: 5 });
  });

  it('rebet refuses the last bets once a table change puts them below the minimum (the layout stays empty) and allows them again when the limits come back', () => {
    const s = new GameSession({ seed: 7, bankroll: 100000 });
    s.placeBet('banker', 50);
    s.placeBet('dragon7', 25);
    s.deal();
    expect(s.getState().lastBets).toEqual({ banker: 50, dragon7: 25 });
    s.setRules(applyTableLevel(DEFAULT_RULES, 'high'));
    expect(s.rebet()).toEqual({ ok: false, reason: 'Banker bet of $50 is below the table minimum of $500' });
    expect(s.getState().bets).toEqual({});
    expect(s.getChipStack()).toEqual([]);
    expect(s.getState().lastBets).toEqual({ banker: 50, dragon7: 25 }); // remembered for when the player comes back
    s.setRules(DEFAULT_RULES);
    expect(s.rebet()).toEqual({ ok: true });
    expect(s.getState().bets).toEqual({ banker: 50, dragon7: 25 });
  });

  it('is reproducible: the same seed and actions give the same hands and bankroll', () => {
    const a = new GameSession({ seed: 2024, bankroll: RICH });
    const b = new GameSession({ seed: 2024, bankroll: RICH });
    const bets = { player: 10, banker: 10, tie: 5, dragon7: 5, panda8: 5 };
    const ra = playHands(a, 40, bets).map((o) => o.result);
    const rb = playHands(b, 40, bets).map((o) => o.result);
    expect(ra).toEqual(rb);
    expect(a.getState().bankroll).toBe(b.getState().bankroll);
    expect(a.getState().stats).toEqual(b.getState().stats);
    const c = new GameSession({ seed: 2025, bankroll: RICH });
    const rc = playHands(c, 40, bets).map((o) => o.result.playerCards.map((card) => card.rank + card.suit));
    expect(rc).not.toEqual(ra.map((r) => r.playerCards.map((card) => card.rank + card.suit)));
  });
});

describe('GameSession: cut card and shoes', () => {
  it('cut card → exactly one more hand → new shoe with history, seen cards and counters reset', () => {
    const s = new GameSession({ seed: 5, bankroll: RICH });
    let hands = 0;
    while (!s.getState().shoe.lastHandNext) {
      s.placeBet('player', 10);
      const o = s.deal();
      hands++;
      expect(o.newShoeStarted).toBe(false);
      expect(s.getState().shoe.shoeNumber).toBe(1);
      expect(hands).toBeLessThan(120);
    }
    const flagged = s.getState();
    expect(flagged.lastHand?.result.cutCardDrawn).toBe(true);
    expect(flagged.shoe.cutCardReached).toBe(true);
    expect(flagged.shoeHistory.filter((r) => r.cutCardDrawn)).toHaveLength(1);
    expect(flagged.shoeHistory).toHaveLength(hands);

    s.placeBet('player', 10);
    const final = s.deal();
    expect(final.newShoeStarted).toBe(true);
    expect(final.result.shoeNumber).toBe(1);
    expect(final.result.handNumber).toBe(hands + 1);
    expect(final.result.cutCardDrawn).toBe(false);
    const fresh = s.getState();
    expect(fresh.shoe.shoeNumber).toBe(2);
    expect(fresh.shoe.lastHandNext).toBe(false);
    expect(fresh.shoe.cutCardReached).toBe(false);
    expect(fresh.shoe.handsDealt).toBe(0);
    expect(fresh.shoeHistory).toEqual([]);
    expect(fresh.seenCards).toEqual([fresh.shoe.exposedBurnCard]);
    expect(fresh.lastHand?.result).toBe(final.result);
    expect(fresh.stats.shoesPlayed).toBe(2);
    expect(fresh.stats.handsPlayed).toBe(hands + 1);
    expect(fresh.totalHands).toBe(hands + 1);

    s.placeBet('player', 10);
    const next = s.deal();
    expect(next.result.shoeNumber).toBe(2);
    expect(next.result.handNumber).toBe(1);
    expect(next.newShoeStarted).toBe(false);
    expect(s.getState().shoeHistory).toHaveLength(1);
  });

  it('newShoe() shuffles a fresh shoe, keeps the layout and counts the shoe only if it was played', () => {
    const s = new GameSession({ seed: 3 });
    s.placeBet('banker', 10);
    const untouched = s.getState();
    s.newShoe();
    expect(s.getState().shoe.shoeNumber).toBe(2);
    expect(s.getState().stats.shoesPlayed).toBe(1);
    expect(s.getState().bets).toEqual({ banker: 10 });
    expect(s.getState()).not.toBe(untouched);
    s.deal();
    s.newShoe();
    expect(s.getState().shoe.shoeNumber).toBe(3);
    expect(s.getState().stats.shoesPlayed).toBe(2);
    expect(s.getState().shoeHistory).toEqual([]);
    expect(s.getState().seenCards).toHaveLength(1);
    expect(s.getState().stats.handsPlayed).toBe(1);
  });

  it('setRules validates, replaces the rules with a copy, clears the layout and starts a new shoe', () => {
    const s = new GameSession({ seed: 3 });
    s.placeBet('player', 10);
    expect(() => s.setRules({ ...cloneRules(DEFAULT_RULES), decks: 7 as unknown as 8 })).toThrow(/Invalid table rules/);
    const rules = cloneRules(RULE_PRESETS.super6.rules);
    s.setRules(rules);
    const state = s.getState();
    expect(state.rules).toEqual(rules);
    expect(state.rules).not.toBe(rules);
    rules.tiePays = 9;
    expect(s.getState().rules.tiePays).toBe(8);
    expect(state.bets).toEqual({});
    expect(s.getChipStack()).toEqual([]);
    expect(state.shoe.shoeNumber).toBe(2);
    expect(state.stats.shoesPlayed).toBe(1);
    expect(s.placeBet('dragon7', 5).ok).toBe(false);
  });
});

describe('GameSession: bankroll and statistics', () => {
  it('keeps the books: net, wagered, commission, streaks, peak/low/drawdown and byBet all reconcile', () => {
    const s = new GameSession({ seed: 11, bankroll: 5000, rules: RULE_PRESETS.commission.rules });
    const bets = { player: 10, banker: 30, tie: 5, playerPair: 5, bankerPair: 5 };
    const outcomes = playHands(s, 150, bets);
    const results = outcomes.map((o) => o.result);
    const state = s.getState();
    const st = state.stats;

    expect(st.handsPlayed).toBe(150);
    expect(st.handsBet).toBe(150);
    expect(state.totalHands).toBe(150);
    expect(st.totalWagered).toBe(150 * 55);
    const net = outcomes.reduce((sum, o) => sum + o.settlement.net, 0);
    expect(st.net).toBeCloseTo(net, 6);
    expect(state.bankroll).toBeCloseTo(5000 + net, 6);
    expect(state.bankroll).toBeCloseTo(st.startingBankroll + st.net, 6);
    expect(st.commissionPaid).toBeCloseTo(outcomes.reduce((sum, o) => sum + o.settlement.commission, 0), 6);
    expect(st.commissionPaid).toBeGreaterThan(0);

    expect(st.playerWins).toBe(results.filter((r) => r.outcome === 'player').length);
    expect(st.bankerWins).toBe(results.filter((r) => r.outcome === 'banker').length);
    expect(st.ties).toBe(results.filter((r) => r.outcome === 'tie').length);
    expect(st.playerWins + st.bankerWins + st.ties).toBe(150);
    expect(st.dragon7s).toBe(results.filter((r) => r.dragon7).length);
    expect(st.panda8s).toBe(results.filter((r) => r.panda8).length);
    expect(st.playerPairs).toBe(results.filter((r) => r.playerPair).length);
    expect(st.bankerPairs).toBe(results.filter((r) => r.bankerPair).length);
    expect(st.naturals).toBe(results.filter((r) => r.playerNatural || r.bankerNatural).length);
    expect(st.naturals).toBeGreaterThan(0);

    // Bankroll trajectory → peak / low / max drawdown.
    let bankroll = 5000;
    let peak = 5000;
    let low = 5000;
    let maxDrawdown = 0;
    for (const o of outcomes) {
      bankroll += o.settlement.net;
      peak = Math.max(peak, bankroll);
      low = Math.min(low, bankroll);
      maxDrawdown = Math.max(maxDrawdown, peak - bankroll);
    }
    expect(st.peakBankroll).toBeCloseTo(peak, 6);
    expect(st.lowBankroll).toBeCloseTo(low, 6);
    expect(st.maxDrawdown).toBeCloseTo(maxDrawdown, 6);

    // Streaks: big-road convention — ties are marks on the current column and never break a P/B streak.
    let longestP = 0;
    let longestB = 0;
    let run = 0;
    let last: HandResult['outcome'] | null = null;
    for (const r of results) {
      if (r.outcome === 'tie') continue;
      run = r.outcome === last ? run + 1 : 1;
      last = r.outcome;
      if (last === 'player') longestP = Math.max(longestP, run);
      if (last === 'banker') longestB = Math.max(longestB, run);
    }
    expect(st.currentStreak).toEqual({ outcome: last, length: run });
    expect(st.longestPlayerStreak).toBe(longestP);
    expect(st.longestBankerStreak).toBe(longestB);
    // The sequence contains "B T B" and "P T P": the engine must carry the streak across the tie.
    const letters = results.map((r) => r.outcome[0].toUpperCase()).join('');
    expect(letters).toMatch(/BTB/);
    expect(letters).toMatch(/PTP/);
    // Per-bet books.
    for (const bet of BET_TYPES) {
      const mine = outcomes.flatMap((o) => o.settlement.settlements.filter((x) => x.bet === bet));
      expect(st.byBet[bet].count).toBe(mine.length);
      expect(st.byBet[bet].wagered).toBeCloseTo(mine.reduce((a, x) => a + x.amount, 0), 6);
      expect(st.byBet[bet].net).toBeCloseTo(mine.reduce((a, x) => a + x.net, 0), 6);
      expect(st.byBet[bet].wins).toBe(mine.filter((x) => x.result === 'win').length);
      expect(st.byBet[bet].losses).toBe(mine.filter((x) => x.result === 'lose').length);
      expect(st.byBet[bet].pushes).toBe(mine.filter((x) => x.result === 'push').length);
    }
    expect(st.byBet.dragon7.count).toBe(0);
    expect(st.byBet.banker.pushes).toBe(st.ties);
  });

  it('a tie never breaks a Player/Banker streak (big-road convention, as on the scoreboard)', () => {
    const s = new GameSession({ seed: 11, bankroll: 5000, rules: RULE_PRESETS.commission.rules });
    const letters: string[] = [];
    let checked = 0;
    for (let i = 0; i < 150; i++) {
      s.placeBet('banker', 10);
      const o = s.deal();
      letters.push(o.result.outcome[0].toUpperCase());
      const streak = s.getState().stats.currentStreak;
      const n = letters.length;
      if (n >= 3 && letters[n - 2] === 'T' && letters[n - 1] === letters[n - 3] && letters[n - 1] !== 'T') {
        // X T X → the streak of X is at least 2 and the tie is not the streak outcome.
        expect(streak.outcome).toBe(letters[n - 1] === 'P' ? 'player' : 'banker');
        expect(streak.length).toBeGreaterThanOrEqual(2);
        checked++;
      }
      if (letters[n - 1] === 'T' && n >= 2 && letters[n - 2] !== 'T') {
        // A tie after a P/B leaves the streak exactly as it was.
        expect(streak.outcome).not.toBe('tie');
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('ties before the first Player/Banker result form a tie streak, like roadStats', () => {
    // Seeded search for a session whose first hand is a tie (deterministic: the seeds are fixed).
    let found: GameSession | null = null;
    for (let seed = 1; seed < 500 && found === null; seed++) {
      const s = new GameSession({ seed, bankroll: 5000 });
      s.placeBet('player', 10);
      if (s.deal().result.outcome === 'tie') found = s;
    }
    expect(found).not.toBeNull();
    const s = found as GameSession;
    expect(s.getState().stats.currentStreak).toEqual({ outcome: 'tie', length: 1 });
    expect(s.getState().stats.longestPlayerStreak).toBe(0);
    expect(s.getState().stats.longestBankerStreak).toBe(0);
    let outcome = 'tie';
    let ties = 1;
    while (outcome === 'tie') {
      s.placeBet('player', 10);
      outcome = s.deal().result.outcome;
      if (outcome === 'tie') {
        ties++;
        expect(s.getState().stats.currentStreak).toEqual({ outcome: 'tie', length: ties });
      }
    }
    expect(s.getState().stats.currentStreak).toEqual({ outcome, length: 1 });
  });

  it('setBankroll treats the difference as a buy-in: net is kept and bankroll = starting + net', () => {
    const s = new GameSession({ seed: 13, bankroll: 200 });
    playHands(s, 10, { player: 10, tie: 5 });
    const before = s.getState();
    s.setBankroll(1000);
    const after = s.getState();
    const delta = 1000 - before.bankroll;
    expect(after.bankroll).toBe(1000);
    expect(after.stats.net).toBe(before.stats.net);
    expect(after.stats.startingBankroll).toBeCloseTo(before.stats.startingBankroll + delta, 6);
    expect(after.bankroll).toBeCloseTo(after.stats.startingBankroll + after.stats.net, 6);
    expect(after.stats.peakBankroll).toBeCloseTo(before.stats.peakBankroll + delta, 6);
    expect(after.stats.lowBankroll).toBeCloseTo(before.stats.lowBankroll + delta, 6);
    expect(after.stats.maxDrawdown).toBe(before.stats.maxDrawdown);
    expect(after.shoeHistory).toBe(before.shoeHistory);
    expect(after.stats.handsPlayed).toBe(10);
    expect(() => s.setBankroll(-5)).toThrow(RangeError);
  });

  it('setBankroll returns the chips when the new bankroll cannot cover the layout', () => {
    const s = new GameSession({ seed: 13, bankroll: 500 });
    s.placeBet('player', 100);
    s.setBankroll(400);
    expect(s.getState().bets).toEqual({ player: 100 });
    s.setBankroll(50);
    expect(s.getState().bets).toEqual({});
    expect(s.getChipStack()).toEqual([]);
    expect(s.getState().bankroll).toBe(50);
  });

  it('reset() starts a fresh session and keeps notifying subscribers', () => {
    const s = new GameSession({ seed: 1 });
    playHands(s, 3);
    const seen: SessionState[] = [];
    const unsubscribe = s.subscribe((state) => seen.push(state));
    s.reset({ seed: 77, bankroll: 300 });
    expect(seen).toHaveLength(1);
    const state = s.getState();
    expect(seen[0]).toBe(state);
    expect(state.seed).toBe(77);
    expect(state.bankroll).toBe(300);
    expect(state.totalHands).toBe(0);
    expect(state.shoeHistory).toEqual([]);
    expect(state.stats.handsPlayed).toBe(0);
    expect(state.stats.startingBankroll).toBe(300);
    expect(state.shoe.shoeNumber).toBe(1);
    expect(new GameSession({ seed: 77, bankroll: 300 }).getState()).toEqual(state);
    unsubscribe();
    s.placeBet('player', 10);
    expect(seen).toHaveLength(1);
  });
});

describe('GameSession: subscriptions and immutability', () => {
  it('notifies subscribers with the new snapshot after every mutation and never mutates old ones', () => {
    const s = new GameSession({ seed: 21 });
    const snapshots: SessionState[] = [];
    const unsubscribe = s.subscribe((state) => snapshots.push(state));
    const initial = s.getState();
    const frozenCopy = structuredClone(initial);

    s.placeBet('player', 10);
    s.placeBet('tie', 5);
    s.undoLastChip();
    s.deal();
    s.rebet();
    s.clearBets();
    s.newShoe();

    expect(snapshots).toHaveLength(7);
    expect(new Set(snapshots).size).toBe(7);
    expect(snapshots.at(-1)).toBe(s.getState());
    expect(initial).toEqual(frozenCopy);
    expect(snapshots[0].bets).toEqual({ player: 10 });
    expect(snapshots[1].bets).toEqual({ player: 10, tie: 5 });
    expect(snapshots[2].bets).toEqual({ player: 10 });
    expect(snapshots[3].bets).toEqual({});
    expect(snapshots[3].lastBets).toEqual({ player: 10 });
    expect(snapshots[4].bets).toEqual({ player: 10 });
    expect(snapshots[3].shoeHistory).toHaveLength(1);
    expect(snapshots[6].shoeHistory).toHaveLength(0);
    expect(snapshots[3].shoeHistory).toHaveLength(1);

    unsubscribe();
    s.placeBet('player', 10);
    expect(snapshots).toHaveLength(7);
  });

  it('getState() returns the same object until something changes', () => {
    const s = new GameSession({ seed: 21 });
    expect(s.getState()).toBe(s.getState());
    expect(s.placeBet('player', 6000).ok).toBe(false);
    expect(s.getState()).toBe(s.getState());
  });
});
