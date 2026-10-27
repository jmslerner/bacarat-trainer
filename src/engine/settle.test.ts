import { describe, expect, it } from 'vitest';
import { BET_LABELS, formatMoney, isBetEnabled, limitsFor, payoutMultiplier, roundCents, settleBets, totalOnLayout, validateBet, validateLayout } from './settle';
import { dealFromValues } from './deal';
import { cloneRules, DEFAULT_RULES, RULE_PRESETS } from './rules';
import { BET_TYPES } from './types';
import type { Bets, BetType, HandResult, TableRules } from './types';

const EZ = DEFAULT_RULES;
const COMMISSION = RULE_PRESETS.commission.rules;
const SUPER6 = RULE_PRESETS.super6.rules;

// Hand-made results (see deal.test.ts for the dealing logic behind each).
const bankerWinTwoCard7 = dealFromValues([2, 3, 'T'], [3, 4]); // Banker 7 (2 cards) over Player 5
const playerNatural9 = dealFromValues([4, 5], [1, 2]); // Player 9 over Banker 3
const tie77 = dealFromValues([3, 4], [2, 5]); // 7–7, both stand
const dragon7 = dealFromValues([2, 3, 1], [1, 2, 4]); // Banker three-card 7 over Player 6
const panda8 = dealFromValues([2, 3, 3], [1, 2, 2]); // Player three-card 8 over Banker 5
const bankerWin6 = dealFromValues([2, 3, 8], [2, 4]); // Banker 6 over Player 3
const pairsBankerWins = dealFromValues(['7', '7', 'T'], ['K', 'K', '9']); // both pairs, Banker 9 over 4
const playerNatural8 = dealFromValues([3, 5], [1, 2]); // natural 8, not a Panda
const tie88ThreeCard = dealFromValues([2, 3, 3], [1, 2, 5]); // 8–8 tie with three-card Player 8
const tie77ThreeCardBanker = dealFromValues([3, 4], [1, 2, 4]); // 7–7 tie with three-card Banker 7

function one(bet: BetType, amount: number, result: HandResult, rules: TableRules = EZ) {
  const s = settleBets({ [bet]: amount }, result, rules);
  expect(s.settlements).toHaveLength(1);
  return s.settlements[0];
}

describe('settleBets: main bets', () => {
  it('Player pays 1:1, loses to Banker, pushes on a tie', () => {
    expect(one('player', 100, playerNatural9)).toEqual({ bet: 'player', amount: 100, result: 'win', net: 100, commission: 0 });
    expect(one('player', 100, bankerWinTwoCard7)).toEqual({ bet: 'player', amount: 100, result: 'lose', net: -100, commission: 0 });
    expect(one('player', 100, tie77)).toEqual({ bet: 'player', amount: 100, result: 'push', net: 0, commission: 0 });
    expect(one('player', 100, dragon7).net).toBe(-100);
  });

  it('EZ Banker pays 1:1 with no commission and pushes on the Dragon 7', () => {
    expect(one('banker', 100, bankerWinTwoCard7)).toEqual({ bet: 'banker', amount: 100, result: 'win', net: 100, commission: 0 });
    expect(one('banker', 100, bankerWin6).net).toBe(100);
    expect(one('banker', 100, playerNatural9)).toEqual({ bet: 'banker', amount: 100, result: 'lose', net: -100, commission: 0 });
    expect(one('banker', 100, tie77)).toEqual({ bet: 'banker', amount: 100, result: 'push', net: 0, commission: 0 });
    expect(one('banker', 100, dragon7)).toEqual({ bet: 'banker', amount: 100, result: 'push', net: 0, commission: 0 });
  });

  it('classic Banker pays 1:1 minus the commission, deducted from the winnings', () => {
    expect(one('banker', 100, bankerWinTwoCard7, COMMISSION)).toEqual({ bet: 'banker', amount: 100, result: 'win', net: 95, commission: 5 });
    expect(one('banker', 15, bankerWinTwoCard7, COMMISSION)).toEqual({ bet: 'banker', amount: 15, result: 'win', net: 14.25, commission: 0.75 });
    // No push on the Dragon 7 at a commission table.
    expect(one('banker', 100, dragon7, COMMISSION)).toEqual({ bet: 'banker', amount: 100, result: 'win', net: 95, commission: 5 });
    expect(one('banker', 100, bankerWin6, COMMISSION).net).toBe(95);
    expect(one('banker', 100, tie77, COMMISSION)).toEqual({ bet: 'banker', amount: 100, result: 'push', net: 0, commission: 0 });
    expect(one('banker', 100, playerNatural9, COMMISSION)).toEqual({ bet: 'banker', amount: 100, result: 'lose', net: -100, commission: 0 });
    const custom: TableRules = { ...cloneRules(COMMISSION), commissionRate: 0.04 };
    expect(one('banker', 50, bankerWinTwoCard7, custom)).toEqual({ bet: 'banker', amount: 50, result: 'win', net: 48, commission: 2 });
  });

  it('Super 6 Banker pays half on a winning 6 and 1:1 otherwise, never pushing on the Dragon 7', () => {
    expect(one('banker', 100, bankerWin6, SUPER6)).toEqual({ bet: 'banker', amount: 100, result: 'win', net: 50, commission: 0 });
    expect(one('banker', 25, bankerWin6, SUPER6).net).toBe(12.5);
    expect(one('banker', 100, bankerWinTwoCard7, SUPER6).net).toBe(100);
    expect(one('banker', 100, dragon7, SUPER6)).toEqual({ bet: 'banker', amount: 100, result: 'win', net: 100, commission: 0 });
    expect(one('banker', 100, tie77, SUPER6).result).toBe('push');
    expect(one('banker', 100, playerNatural9, SUPER6).net).toBe(-100);
  });

  it("Tie pays 8:1 (or the table's tiePays) and loses otherwise", () => {
    expect(one('tie', 10, tie77)).toEqual({ bet: 'tie', amount: 10, result: 'win', net: 80, commission: 0 });
    expect(one('tie', 10, tie77, { ...cloneRules(EZ), tiePays: 9 }).net).toBe(90);
    expect(one('tie', 10, playerNatural9)).toEqual({ bet: 'tie', amount: 10, result: 'lose', net: -10, commission: 0 });
    expect(one('tie', 10, bankerWinTwoCard7).net).toBe(-10);
  });
});

describe('settleBets: side bets', () => {
  it('Dragon 7 pays 40:1 only on a Banker win with a three-card 7', () => {
    expect(one('dragon7', 10, dragon7)).toEqual({ bet: 'dragon7', amount: 10, result: 'win', net: 400, commission: 0 });
    expect(one('dragon7', 10, bankerWinTwoCard7).net).toBe(-10);
    expect(one('dragon7', 10, tie77ThreeCardBanker).net).toBe(-10);
    expect(one('dragon7', 10, playerNatural9).net).toBe(-10);
    expect(one('dragon7', 10, dragon7, { ...cloneRules(EZ), dragon7Pays: 50 }).net).toBe(500);
  });

  it('Panda 8 pays 25:1 only on a Player win with a three-card 8', () => {
    expect(one('panda8', 10, panda8)).toEqual({ bet: 'panda8', amount: 10, result: 'win', net: 250, commission: 0 });
    expect(one('panda8', 10, playerNatural8).net).toBe(-10);
    expect(one('panda8', 10, tie88ThreeCard).net).toBe(-10);
    expect(one('panda8', 10, dragon7).net).toBe(-10);
  });

  it('Pairs pay 11:1 on the first two cards, independent of who wins', () => {
    const s = settleBets({ player: 100, playerPair: 10, bankerPair: 10 }, pairsBankerWins, EZ);
    expect(s.settlements).toEqual([
      { bet: 'player', amount: 100, result: 'lose', net: -100, commission: 0 },
      { bet: 'playerPair', amount: 10, result: 'win', net: 110, commission: 0 },
      { bet: 'bankerPair', amount: 10, result: 'win', net: 110, commission: 0 },
    ]);
    expect(s.net).toBe(120);
    expect(s.totalWagered).toBe(120);
    expect(one('playerPair', 10, panda8).net).toBe(-10);
    expect(one('bankerPair', 10, panda8).net).toBe(-10);
    expect(one('playerPair', 10, pairsBankerWins, { ...cloneRules(EZ), pairPays: 12 }).net).toBe(120);
  });
});

describe('settleBets: the whole layout', () => {
  it('settles in BET_TYPES order, skips empty spots and totals net, commission and wagered', () => {
    const bets: Bets = { bankerPair: 5, banker: 100, tie: 0, dragon7: 5, player: undefined };
    const s = settleBets(bets, dragon7, COMMISSION);
    expect(s.settlements.map((x) => x.bet)).toEqual(['banker', 'dragon7', 'bankerPair']);
    expect(s.settlements[0]).toEqual({ bet: 'banker', amount: 100, result: 'win', net: 95, commission: 5 });
    expect(s.settlements[1].net).toBe(200);
    expect(s.settlements[2].net).toBe(-5);
    expect(s.net).toBe(290);
    expect(s.commission).toBe(5);
    expect(s.totalWagered).toBe(110);
    expect(settleBets({}, dragon7, EZ)).toEqual({ settlements: [], net: 0, commission: 0, totalWagered: 0 });
  });

  it('a tie pushes the main bets while the other bets lose', () => {
    const s = settleBets({ player: 50, banker: 50, tie: 5, dragon7: 5, panda8: 5, playerPair: 5, bankerPair: 5 }, tie77, EZ);
    expect(s.settlements.map((x) => `${x.bet}:${x.result}`)).toEqual([
      'player:push', 'banker:push', 'tie:win', 'dragon7:lose', 'panda8:lose', 'playerPair:lose', 'bankerPair:lose',
    ]);
    expect(s.net).toBe(40 - 20);
  });
});

describe('payouts, limits and validation', () => {
  it('payoutMultiplier reflects the table', () => {
    expect(BET_TYPES.map((b) => payoutMultiplier(b, EZ))).toEqual([1, 1, 8, 40, 25, 11, 11]);
    const custom: TableRules = { ...cloneRules(EZ), tiePays: 9, dragon7Pays: 45, panda8Pays: 30, pairPays: 12 };
    expect(BET_TYPES.map((b) => payoutMultiplier(b, custom))).toEqual([1, 1, 9, 45, 30, 12, 12]);
    expect(payoutMultiplier('banker', COMMISSION)).toBe(1);
  });

  it('limitsFor / isBetEnabled / BET_LABELS', () => {
    expect(limitsFor('player', EZ)).toBe(EZ.limits.main);
    expect(limitsFor('banker', EZ)).toBe(EZ.limits.main);
    expect(limitsFor('tie', EZ)).toBe(EZ.limits.tie);
    for (const side of ['dragon7', 'panda8', 'playerPair', 'bankerPair'] as const) expect(limitsFor(side, EZ)).toBe(EZ.limits.side);
    expect(BET_TYPES.map((b) => isBetEnabled(b, COMMISSION))).toEqual([true, true, true, false, false, true, true]);
    expect(BET_LABELS).toEqual({ player: 'Player', banker: 'Banker', tie: 'Tie', dragon7: 'Dragon 7', panda8: 'Panda 8', playerPair: 'Player Pair', bankerPair: 'Banker Pair' });
  });

  it('validateBet enforces positive amounts, availability and the maximum', () => {
    expect(validateBet('player', 10, EZ)).toBeNull();
    expect(validateBet('player', 5000, EZ)).toBeNull();
    expect(validateBet('player', 5001, EZ)).toBe('Player bet cannot exceed the table maximum of $5,000');
    expect(validateBet('tie', 501, EZ)).toBe('Tie bet cannot exceed the table maximum of $500');
    expect(validateBet('dragon7', 500.5, EZ)).toMatch(/maximum of \$500/);
    expect(validateBet('panda8', 5, COMMISSION)).toBe('Panda 8 is not offered at this table');
    expect(validateBet('dragon7', 5, SUPER6)).toBe('Dragon 7 is not offered at this table');
    expect(validateBet('playerPair', 5, { ...cloneRules(EZ), sideBets: { dragon7: true, panda8: true, pairs: false } })).toBe('Player Pair is not offered at this table');
    expect(validateBet('player', 0, EZ)).toBe('Bet amount must be a positive number');
    expect(validateBet('player', -5, EZ)).toBe('Bet amount must be a positive number');
    expect(validateBet('player', Number.NaN, EZ)).toBe('Bet amount must be a positive number');
    expect(validateBet('bogus' as BetType, 5, EZ)).toMatch(/Unknown bet/);
    // Below the minimum is fine at placement time (chips are added one at a time).
    expect(validateBet('player', 1, EZ)).toBeNull();
  });

  it('validateLayout needs a bet and enforces every minimum at deal time', () => {
    expect(validateLayout({}, EZ)).toEqual(['Place a bet to deal']);
    expect(validateLayout({ player: 0 }, EZ)).toEqual(['Place a bet to deal']);
    expect(validateLayout({ player: 10 }, EZ)).toEqual([]);
    expect(validateLayout({ player: 5 }, EZ)).toEqual(['Player bet of $5 is below the table minimum of $10']);
    expect(validateLayout({ tie: 4, dragon7: 5 }, EZ)).toEqual(['Tie bet of $4 is below the table minimum of $5']);
    expect(validateLayout({ player: 10, panda8: 2.5 }, EZ)).toEqual(['Panda 8 bet of $2.50 is below the table minimum of $5']);
    expect(validateLayout({ banker: 6000 }, EZ)).toEqual(['Banker bet cannot exceed the table maximum of $5,000']);
    expect(validateLayout({ player: 10, panda8: 5 }, COMMISSION)).toEqual(['Panda 8 is not offered at this table']);
    expect(validateLayout({ player: 1, tie: 1 }, EZ)).toHaveLength(2);
  });

  it('totalOnLayout, formatMoney and roundCents', () => {
    expect(totalOnLayout({})).toBe(0);
    expect(totalOnLayout({ player: 10, tie: 5, dragon7: 0 })).toBe(15);
    expect(formatMoney(5000)).toBe('$5,000');
    expect(formatMoney(10)).toBe('$10');
    expect(formatMoney(2.5)).toBe('$2.50');
    expect(formatMoney(14.25)).toBe('$14.25');
    expect(formatMoney(-3)).toBe('-$3');
    expect(formatMoney(1234567.891)).toBe('$1,234,567.89');
    expect(roundCents(0.575)).toBe(0.58);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(10.1 + 0.2)).toBe(10.3);
    expect(roundCents(-0.575)).toBe(-0.58);
    expect(roundCents(100)).toBe(100);
  });
});
