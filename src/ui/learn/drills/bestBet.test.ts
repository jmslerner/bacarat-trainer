import { describe, expect, it } from 'vitest';
import { BET_TYPES, DEFAULT_RULES, RULE_PRESETS, createRng, houseEdge, isBetEnabled } from '@/engine';
import { betPaysLabel, explainBestBet, formatEdge, generateBestBetQuestion } from './bestBet';
import { questionSeed } from './seeds';

describe('generateBestBetQuestion', () => {
  it('lists 3–4 distinct offered bets with the engine’s edges and a unique answer', () => {
    let fours = 0;
    let highest = 0;
    for (let seed = 0; seed < 400; seed++) {
      const q = generateBestBetQuestion(createRng(questionSeed(seed, 0)), DEFAULT_RULES);
      expect(q.options.length === 3 || q.options.length === 4).toBe(true);
      if (q.options.length === 4) fours++;
      if (q.mode === 'highest') highest++;
      const bets = q.options.map((o) => o.bet);
      expect(new Set(bets).size).toBe(bets.length);
      expect(bets.includes('playerPair') && bets.includes('bankerPair')).toBe(false);
      for (const o of q.options) {
        expect(isBetEnabled(o.bet, DEFAULT_RULES)).toBe(true);
        expect(o.edge).toBeCloseTo(houseEdge(o.bet, DEFAULT_RULES), 12);
      }
      const edges = q.options.map((o) => o.edge);
      const target = q.mode === 'lowest' ? Math.min(...edges) : Math.max(...edges);
      const winners = q.options.filter((o) => Math.abs(o.edge - target) < 1e-9);
      expect(winners).toHaveLength(1);
      expect(winners[0].bet).toBe(q.answer);
    }
    expect(fours).toBeGreaterThan(100);
    expect(highest).toBeGreaterThan(50);
    expect(highest).toBeLessThan(160);
  });

  it('respects the active table (no Dragon 7 / Panda 8 on the classic preset)', () => {
    const rules = RULE_PRESETS.commission.rules;
    for (let seed = 0; seed < 100; seed++) {
      const q = generateBestBetQuestion(createRng(questionSeed(seed, 0)), rules);
      for (const o of q.options) {
        expect(o.bet).not.toBe('dragon7');
        expect(o.bet).not.toBe('panda8');
      }
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateBestBetQuestion(createRng(5), DEFAULT_RULES)).toEqual(generateBestBetQuestion(createRng(5), DEFAULT_RULES));
  });
});

describe('labels and explanation', () => {
  it('describes how each bet pays on each preset', () => {
    expect(betPaysLabel('banker', DEFAULT_RULES)).toBe('1:1, no commission (push on Dragon 7)');
    expect(betPaysLabel('banker', RULE_PRESETS.commission.rules)).toBe('1:1 minus 5% commission');
    expect(betPaysLabel('banker', RULE_PRESETS.super6.rules)).toBe('1:1, a winning 6 pays 1:2');
    expect(betPaysLabel('tie', DEFAULT_RULES)).toBe('8:1');
    expect(betPaysLabel('dragon7', DEFAULT_RULES)).toBe('40:1');
    expect(betPaysLabel('panda8', DEFAULT_RULES)).toBe('25:1');
    expect(betPaysLabel('playerPair', DEFAULT_RULES)).toBe('11:1');
    expect(formatEdge(houseEdge('banker', DEFAULT_RULES))).toBe('1.02%');
    expect(formatEdge(houseEdge('tie', DEFAULT_RULES))).toBe('14.36%');
  });

  it('ranks the options and names the cheapest and dearest', () => {
    const q = {
      mode: 'lowest' as const,
      options: BET_TYPES.filter((b) => b !== 'bankerPair').map((bet) => ({ bet, label: bet, pays: '', edge: houseEdge(bet, DEFAULT_RULES) })),
      answer: 'banker' as const,
    };
    const e = explainBestBet(q, DEFAULT_RULES);
    expect(e.ranked.map((o) => o.bet)).toEqual(['banker', 'player', 'dragon7', 'panda8', 'playerPair', 'tie']);
    expect(e.lines[0]).toMatch(/^banker is the cheapest bet listed: 1\.02% house edge/);
    expect(e.lines[1]).toMatch(/^tie is the most expensive at 14\.36% — 14× the cost of banker/);
    expect(e.lines.some((l) => /EZ Banker/.test(l))).toBe(true);
    expect(e.lines.some((l) => /Side bets/.test(l))).toBe(true);
  });
});
