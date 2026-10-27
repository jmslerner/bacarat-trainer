import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_PRESETS, createRng, dealFromValues, handTotal, isBetEnabled, limitsFor, settleBets } from '@/engine';
import type { BetType } from '@/engine';
import { describeOutcome, explainSettlement, generatePayoutQuestion, isNetCorrect, outcomeBadges, parseNetAnswer, signedMoney } from './payout';
import { questionSeed } from './seeds';

describe('generatePayoutQuestion', () => {
  it('produces bets the table offers and a settlement that is exactly the engine’s', () => {
    const scenarios = new Map<string, number>();
    for (let seed = 0; seed < 400; seed++) {
      const q = generatePayoutQuestion(createRng(questionSeed(seed, 0)), DEFAULT_RULES);
      const bets = Object.entries(q.bets) as [BetType, number][];
      expect(bets.length).toBeGreaterThanOrEqual(1);
      expect(bets.length).toBeLessThanOrEqual(3);
      for (const [bet, amount] of bets) {
        expect(isBetEnabled(bet, DEFAULT_RULES)).toBe(true);
        const { min, max } = limitsFor(bet, DEFAULT_RULES);
        expect(amount).toBeGreaterThanOrEqual(min);
        expect(amount).toBeLessThanOrEqual(max);
      }
      expect(q.settlement).toEqual(settleBets(q.bets, q.result, DEFAULT_RULES));
      expect(handTotal(q.result.playerCards)).toBe(q.result.playerTotal);
      expect(handTotal(q.result.bankerCards)).toBe(q.result.bankerTotal);
      scenarios.set(q.scenario, (scenarios.get(q.scenario) ?? 0) + 1);
      switch (q.scenario) {
        case 'tie':
          expect(q.result.outcome).toBe('tie');
          break;
        case 'dragon7':
          expect(q.result.dragon7).toBe(true);
          expect(q.bets.banker).toBeGreaterThan(0);
          break;
        case 'panda8':
          expect(q.result.panda8).toBe(true);
          break;
        case 'pair':
          expect(q.result.playerPair || q.result.bankerPair).toBe(true);
          break;
        case 'banker6':
          throw new Error('banker6 is only generated for Super 6 tables');
        default:
          break;
      }
    }
    for (const s of ['plain', 'tie', 'dragon7', 'panda8', 'pair']) expect(scenarios.get(s) ?? 0).toBeGreaterThan(10);
  });

  it('never bets a side bet the table does not offer (classic preset) and explains the commission', () => {
    const rules = RULE_PRESETS.commission.rules;
    let commissionSeen = false;
    for (let seed = 0; seed < 200; seed++) {
      const q = generatePayoutQuestion(createRng(questionSeed(seed, 0)), rules);
      expect(q.bets.dragon7).toBeUndefined();
      expect(q.bets.panda8).toBeUndefined();
      expect(q.settlement).toEqual(settleBets(q.bets, q.result, rules));
      const banker = q.settlement.settlements.find((s) => s.bet === 'banker');
      if (banker && banker.result === 'win') {
        commissionSeen = true;
        expect(banker.commission).toBeGreaterThan(0);
        expect(explainSettlement(banker, q.result, rules)).toMatch(/commission/);
      }
    }
    expect(commissionSeen).toBe(true);
  });

  it('generates the Super 6 half-pay case on Super 6 tables', () => {
    const rules = RULE_PRESETS.super6.rules;
    let halfPay = 0;
    for (let seed = 0; seed < 200; seed++) {
      const q = generatePayoutQuestion(createRng(questionSeed(seed, 0)), rules);
      if (q.scenario === 'banker6') {
        expect(q.result.bankerWinOn6).toBe(true);
        const banker = q.settlement.settlements.find((s) => s.bet === 'banker');
        expect(banker?.net).toBe((q.bets.banker ?? 0) / 2);
        expect(explainSettlement(banker!, q.result, rules)).toMatch(/Super 6/);
        halfPay++;
      }
    }
    expect(halfPay).toBeGreaterThan(5);
  });

  it('is deterministic for a seed', () => {
    const a = generatePayoutQuestion(createRng(7), DEFAULT_RULES);
    const b = generatePayoutQuestion(createRng(7), DEFAULT_RULES);
    expect(a).toEqual(b);
  });
});

describe('explainSettlement', () => {
  it('teaches the Dragon 7 push on EZ Banker and the 40:1 bonus', () => {
    // Player A,2 (3) draws a T → 3; Banker 2,T (2) draws a 5 → 7: Banker wins with a three-card 7.
    const result = dealFromValues([1, 2, 'T'], [2, 'T', 5]);
    expect(result.dragon7).toBe(true);
    expect(result.outcome).toBe('banker');
    const settlement = settleBets({ banker: 100, dragon7: 5 }, result, DEFAULT_RULES);
    const banker = settlement.settlements.find((s) => s.bet === 'banker')!;
    const dragon = settlement.settlements.find((s) => s.bet === 'dragon7')!;
    expect(banker.result).toBe('push');
    expect(explainSettlement(banker, result, DEFAULT_RULES)).toMatch(/THREE-card 7.*Dragon 7.*push/);
    expect(dragon.net).toBe(200);
    expect(explainSettlement(dragon, result, DEFAULT_RULES)).toMatch(/40:1/);
    expect(explainSettlement(dragon, result, DEFAULT_RULES)).toMatch(/\+\$200/);
    expect(describeOutcome(result)).toBe('Banker wins, 7 over 3');
    expect(outcomeBadges(result)).toEqual(['Dragon 7']);
  });

  it('explains the classic commission and a two-card Banker 7', () => {
    const rules = RULE_PRESETS.commission.rules;
    const result = dealFromValues([1, 2, 'T'], [2, 'T', 5], rules);
    const banker = settleBets({ banker: 100 }, result, rules).settlements[0];
    expect(banker.net).toBe(95);
    expect(explainSettlement(banker, result, rules)).toMatch(/5% commission: \$100 − \$5 = \+\$95/);

    // Two-card Banker 7 vs Player 3: not a Dragon 7.
    const two = dealFromValues([1, 2, 'T'], [3, 4]);
    expect(two.bankerCards).toHaveLength(2);
    expect(two.dragon7).toBe(false);
    const s = settleBets({ banker: 50, dragon7: 5 }, two, DEFAULT_RULES);
    expect(explainSettlement(s.settlements[0], two, DEFAULT_RULES)).toMatch(/TWO-card 7.*not a Dragon 7/);
    expect(explainSettlement(s.settlements[1], two, DEFAULT_RULES)).toMatch(/TWO-card 7/);
  });

  it('explains the Super 6 half pay', () => {
    const rules = RULE_PRESETS.super6.rules;
    // Player A,2 (3) draws T → 3; Banker 2,4 (6) stands on a 0 → Banker wins with 6.
    const result = dealFromValues([1, 2, 'T'], [2, 4], rules);
    expect(result.bankerWinOn6).toBe(true);
    const banker = settleBets({ banker: 100 }, result, rules).settlements[0];
    expect(banker.net).toBe(50);
    expect(explainSettlement(banker, result, rules)).toMatch(/Super 6.*half/);
  });

  it('explains ties, the 7–7 non-dragon, naturals and pairs', () => {
    const tie = dealFromValues([3, 4], [2, 5]);
    expect(tie.outcome).toBe('tie');
    const s = settleBets({ player: 50, tie: 10, dragon7: 5 }, tie, DEFAULT_RULES);
    expect(explainSettlement(s.settlements[0], tie, DEFAULT_RULES)).toMatch(/push/);
    expect(explainSettlement(s.settlements[1], tie, DEFAULT_RULES)).toMatch(/8:1.*\+\$80/);
    expect(explainSettlement(s.settlements[2], tie, DEFAULT_RULES)).toMatch(/7–7 tie is NOT a Dragon 7/);

    const natural = dealFromValues([3, 5], [2, 4]);
    expect(natural.playerNatural).toBe(true);
    const n = settleBets({ panda8: 5, playerPair: 5 }, natural, DEFAULT_RULES);
    expect(explainSettlement(n.settlements[0], natural, DEFAULT_RULES)).toMatch(/natural/);
    expect(explainSettlement(n.settlements[1], natural, DEFAULT_RULES)).toMatch(/not a pair.*first two cards/);

    // Player 7,7 (4) draws a K → 4; Banker 2,4 (6) stands on a 0: Banker wins, but the Player Pair still pays.
    const pair = dealFromValues(['7', '7', 'K'], [2, 4]);
    expect(pair.playerPair).toBe(true);
    expect(pair.outcome).toBe('banker');
    const p = settleBets({ playerPair: 10 }, pair, DEFAULT_RULES);
    expect(p.settlements[0].net).toBe(110);
    expect(explainSettlement(p.settlements[0], pair, DEFAULT_RULES)).toMatch(/11:1/);
  });
});

describe('answers', () => {
  it('parses what players type', () => {
    expect(parseNetAnswer('95')).toBe(95);
    expect(parseNetAnswer('-95')).toBe(-95);
    expect(parseNetAnswer('+95')).toBe(95);
    expect(parseNetAnswer('$95')).toBe(95);
    expect(parseNetAnswer('−95')).toBe(-95);
    expect(parseNetAnswer('(95)')).toBe(-95);
    expect(parseNetAnswer(' 1,250.50 ')).toBe(1250.5);
    expect(parseNetAnswer('0')).toBe(0);
    expect(parseNetAnswer('')).toBeNull();
    expect(parseNetAnswer('-')).toBeNull();
    expect(parseNetAnswer('abc')).toBeNull();
  });
  it('compares to the cent', () => {
    expect(isNetCorrect(95, 95)).toBe(true);
    expect(isNetCorrect(95.004, 95)).toBe(true);
    expect(isNetCorrect(94.99, 95)).toBe(false);
  });
  it('formats signed money', () => {
    expect(signedMoney(95)).toBe('+$95');
    expect(signedMoney(-5)).toBe('−$5');
    expect(signedMoney(0)).toBe('$0');
    expect(signedMoney(2.5)).toBe('+$2.50');
  });
});
