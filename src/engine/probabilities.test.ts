import { describe, expect, it } from 'vitest';
import groundTruth from '../../docs/probabilities.json';
import { EOR_8_DECKS, EOR_8_DECKS_MAIN, EXACT_6_DECKS, EXACT_8_DECKS, exactProbabilities, expectedValue, expectedValuePerUnit, houseEdge, outcomeProbabilities, winProbability } from './probabilities';
import { cloneRules, DEFAULT_RULES, RULE_PRESETS } from './rules';
import { BET_TYPES } from './types';
import type { TableRules } from './types';

const EZ = DEFAULT_RULES;
const SIX: TableRules = { ...cloneRules(EZ), decks: 6 };

type EorRow = { dragon7_ev_change: number; panda8_ev_change: number; banker_ez_ev_change: number; player_ev_change: number; tie8_ev_change: number };

describe('exact probabilities (SPEC §3)', () => {
  it('8 decks', () => {
    const p = exactProbabilities(8);
    expect(p).toBe(EXACT_8_DECKS);
    expect(p.player).toBeCloseTo(0.4462466093, 10);
    expect(p.banker).toBeCloseTo(0.4585974226, 10);
    expect(p.tie).toBeCloseTo(0.095155968, 10);
    expect(p.dragon7).toBeCloseTo(0.0225338209, 10);
    expect(p.panda8).toBeCloseTo(0.0345432184, 10);
    expect(p.bankerWin6).toBeCloseTo(0.0538637159, 10);
    expect(p.natural).toBeCloseTo(0.1894346617, 10);
    expect(p.pair).toBeCloseTo(31 / 415, 12);
    expect(p.cards4).toBeCloseTo(0.3788684909, 10);
    expect(p.cards5).toBeCloseTo(0.3034441685, 10);
    expect(p.cards6).toBeCloseTo(0.3176873406, 10);
    expect(p.player + p.banker + p.tie).toBeCloseTo(1, 12);
    expect(p.cards4 + p.cards5 + p.cards6).toBeCloseTo(1, 12);
  });

  it('6 decks', () => {
    const p = exactProbabilities(6);
    expect(p).toBe(EXACT_6_DECKS);
    expect(p.player).toBeCloseTo(0.4462785698, 10);
    expect(p.banker).toBeCloseTo(0.4586527188, 10);
    expect(p.tie).toBeCloseTo(0.0950687113, 10);
    expect(p.dragon7).toBeCloseTo(0.0225350755, 10);
    expect(p.panda8).toBeCloseTo(0.0345356218, 10);
    expect(p.bankerWin6).toBeCloseTo(0.0538444511, 10);
    expect(p.pair).toBeCloseTo(23 / 311, 12);
    expect(p.player + p.banker + p.tie).toBeCloseTo(1, 12);
    expect(p.cards4 + p.cards5 + p.cards6).toBeCloseTo(1, 12);
  });

  it('matches docs/probabilities.json exactly', () => {
    for (const [decks, table] of [[8, groundTruth.decks_8], [6, groundTruth.decks_6]] as const) {
      const p = exactProbabilities(decks);
      expect(p.player).toBe(table.player);
      expect(p.banker).toBe(table.banker);
      expect(p.tie).toBe(table.tie);
      expect(p.dragon7).toBe(table.dragon7);
      expect(p.panda8).toBe(table.panda8);
      expect(p.bankerWin6).toBe(table.banker_win_6);
      expect(p.natural).toBe(table.player_natural);
      expect(p.natural).toBe(table.banker_natural);
      expect(p.pair).toBe(table.pair_prob);
      expect(p.cards4).toBe(table.cards4);
      expect(p.cards5).toBe(table.cards5);
      expect(p.cards6).toBe(table.cards6);
    }
  });

  it('effect of removal (8 decks) matches SPEC §3 and the JSON', () => {
    expect(EOR_8_DECKS.dragon7).toHaveLength(10);
    expect(EOR_8_DECKS.panda8).toHaveLength(10);
    const specDragon = [0.000863, 0.000498, -0.000896, -0.001076, -0.00268, -0.002635, -0.003242, -0.003584, 0.005378, 0.004785];
    const specPanda = [0.001208, 0.001322, 0.001444, -0.002861, -0.002536, -0.002655, -0.000892, -0.000914, -0.002241, 0.004502];
    const eor = groundTruth.decks_8.eor as Record<string, EorRow>;
    for (let v = 0; v <= 9; v++) {
      expect(EOR_8_DECKS.dragon7[v]).toBeCloseTo(specDragon[v], 6);
      expect(EOR_8_DECKS.panda8[v]).toBeCloseTo(specPanda[v], 6);
      expect(EOR_8_DECKS.dragon7[v]).toBe(eor[String(v)].dragon7_ev_change);
      expect(EOR_8_DECKS.panda8[v]).toBe(eor[String(v)].panda8_ev_change);
      expect(EOR_8_DECKS_MAIN.bankerEz[v]).toBe(eor[String(v)].banker_ez_ev_change);
      expect(EOR_8_DECKS_MAIN.player[v]).toBe(eor[String(v)].player_ev_change);
      expect(EOR_8_DECKS_MAIN.tie8[v]).toBe(eor[String(v)].tie8_ev_change);
    }
    // Jacobson's Dragon 7 count follows the signs: 4–7 hurt the bet, 8 and 9 help it.
    for (const v of [4, 5, 6, 7]) expect(EOR_8_DECKS.dragon7[v]).toBeLessThan(0);
    for (const v of [8, 9]) expect(EOR_8_DECKS.dragon7[v]).toBeGreaterThan(0);
    expect(Object.isFrozen(EOR_8_DECKS.dragon7)).toBe(true);
  });
});

describe('house edges (SPEC §3)', () => {
  it('8 decks, every bet and Banker variant', () => {
    expect(houseEdge('player', EZ)).toBeCloseTo(0.012351, 6);
    expect(houseEdge('banker', RULE_PRESETS.commission.rules)).toBeCloseTo(0.010579, 6);
    expect(houseEdge('banker', EZ)).toBeCloseTo(0.010183, 6);
    expect(houseEdge('banker', RULE_PRESETS.super6.rules)).toBeCloseTo(0.014581, 6);
    expect(houseEdge('tie', EZ)).toBeCloseTo(0.143596, 6);
    expect(houseEdge('tie', { ...cloneRules(EZ), tiePays: 9 })).toBeCloseTo(0.04844, 6);
    expect(houseEdge('dragon7', EZ)).toBeCloseTo(0.076113, 6);
    expect(houseEdge('panda8', EZ)).toBeCloseTo(0.101876, 6);
    expect(houseEdge('playerPair', EZ)).toBeCloseTo(0.103614, 6);
    expect(houseEdge('bankerPair', EZ)).toBeCloseTo(0.103614, 6);
    expect(houseEdge('playerPair', { ...cloneRules(EZ), pairPays: 12 })).toBeCloseTo(0.028916, 6);
  });

  it('6 decks', () => {
    expect(houseEdge('player', SIX)).toBeCloseTo(0.012374, 6);
    expect(houseEdge('banker', { ...SIX, bankerRule: 'commission' })).toBeCloseTo(0.010558, 6);
    expect(houseEdge('banker', SIX)).toBeCloseTo(0.010161, 6);
    expect(houseEdge('banker', { ...SIX, bankerRule: 'super6' })).toBeCloseTo(0.014548, 6);
    expect(houseEdge('tie', SIX)).toBeCloseTo(0.144382, 6);
    expect(houseEdge('tie', { ...SIX, tiePays: 9 })).toBeCloseTo(0.049313, 6);
    expect(houseEdge('dragon7', SIX)).toBeCloseTo(0.076062, 6);
    expect(houseEdge('panda8', SIX)).toBeCloseTo(0.102074, 6);
    expect(houseEdge('playerPair', SIX)).toBeCloseTo(0.11254, 6);
  });

  it('agrees with the JSON edges to full precision', () => {
    for (const [rules, table] of [[EZ, groundTruth.decks_8], [SIX, groundTruth.decks_6]] as const) {
      expect(expectedValuePerUnit('player', rules)).toBeCloseTo(table.edges.player_1to1, 12);
      expect(expectedValuePerUnit('banker', { ...rules, bankerRule: 'commission' })).toBeCloseTo(table.edges.banker_5pct_commission, 12);
      expect(expectedValuePerUnit('banker', rules)).toBeCloseTo(table.edges.banker_ez_push_dragon7, 12);
      expect(expectedValuePerUnit('banker', { ...rules, bankerRule: 'super6' })).toBeCloseTo(table.edges.banker_super6_half_on_6, 12);
      expect(expectedValuePerUnit('tie', rules)).toBeCloseTo(table.edges.tie_8to1, 12);
      expect(expectedValuePerUnit('tie', { ...rules, tiePays: 9 })).toBeCloseTo(table.edges.tie_9to1, 12);
      expect(expectedValuePerUnit('dragon7', rules)).toBeCloseTo(table.edges.dragon7_40to1, 12);
      expect(expectedValuePerUnit('panda8', rules)).toBeCloseTo(table.edges.panda8_25to1, 12);
      expect(expectedValuePerUnit('playerPair', rules)).toBeCloseTo(table.edges.pair_11to1, 12);
      expect(expectedValuePerUnit('bankerPair', { ...rules, pairPays: 12 })).toBeCloseTo(table.edges.pair_12to1, 12);
    }
  });

  it('honours a custom commission rate', () => {
    const p = exactProbabilities(8);
    const rules: TableRules = { ...cloneRules(EZ), bankerRule: 'commission', commissionRate: 0.04 };
    expect(houseEdge('banker', rules)).toBeCloseTo(p.player - 0.96 * p.banker, 12);
  });

  it('expectedValue scales the edge by the amount (negative = expected loss)', () => {
    for (const bet of BET_TYPES) {
      expect(expectedValue(bet, 100, EZ)).toBeCloseTo(-100 * houseEdge(bet, EZ), 10);
      expect(expectedValue(bet, 100, EZ)).toBeLessThan(0);
    }
    expect(expectedValue('banker', 1000, EZ)).toBeCloseTo(-10.183, 3);
  });
});

describe('win probabilities', () => {
  it('reflect the bet and the Banker rule', () => {
    const p = exactProbabilities(8);
    expect(winProbability('player', EZ)).toBe(p.player);
    expect(winProbability('banker', EZ)).toBeCloseTo(p.banker - p.dragon7, 12);
    expect(winProbability('banker', RULE_PRESETS.commission.rules)).toBe(p.banker);
    expect(winProbability('banker', RULE_PRESETS.super6.rules)).toBe(p.banker);
    expect(winProbability('tie', EZ)).toBe(p.tie);
    expect(winProbability('dragon7', EZ)).toBe(p.dragon7);
    expect(winProbability('panda8', EZ)).toBe(p.panda8);
    expect(winProbability('playerPair', EZ)).toBe(p.pair);
    expect(winProbability('bankerPair', SIX)).toBe(exactProbabilities(6).pair);
  });

  it('win + push + lose = 1 for every bet', () => {
    for (const rules of [EZ, RULE_PRESETS.commission.rules, RULE_PRESETS.super6.rules, SIX]) {
      for (const bet of BET_TYPES) {
        const o = outcomeProbabilities(bet, rules);
        expect(o.win + o.push + o.lose).toBeCloseTo(1, 12);
        expect(o.win).toBeGreaterThan(0);
      }
    }
    expect(outcomeProbabilities('banker', EZ).push).toBeCloseTo(exactProbabilities(8).tie + exactProbabilities(8).dragon7, 12);
    expect(outcomeProbabilities('player', EZ).push).toBe(exactProbabilities(8).tie);
    expect(outcomeProbabilities('tie', EZ).push).toBe(0);
  });
});
