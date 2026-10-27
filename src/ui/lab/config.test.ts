import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_PRESETS } from '@/engine';
import { validateSimConfig } from '@/strategy';
import {
  LAB_LIMITS,
  LAB_PRESETS,
  applyLabPreset,
  defaultLabConfig,
  estimateHands,
  handsPerShoe,
  matchLabPreset,
  normalizeSystemParams,
  resolveRules,
  sanitizeLabConfig,
  toSimConfig,
  validateLabConfig,
} from './config';

const base = defaultLabConfig({ bankroll: 1000, seed: 42 });

describe('defaults and presets', () => {
  it('the default form is a valid simulation with no warnings', () => {
    const v = validateLabConfig(base, DEFAULT_RULES);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(validateSimConfig(v.sim)).toEqual([]);
    expect(v.hands).toBeGreaterThan(700_000);
    expect(v.hands).toBeLessThan(900_000);
    expect(base.seed).toBe(42);
    expect(base.bankroll).toBe(1000);
  });

  it('falls back to the default bankroll and a random seed when the options are unusable', () => {
    const c = defaultLabConfig({ bankroll: -5, seed: Number.NaN });
    expect(c.bankroll).toBe(1000);
    expect(Number.isInteger(c.seed)).toBe(true);
  });

  it('has the five SPEC presets, each valid and recognised by matchLabPreset', () => {
    expect(LAB_PRESETS.map((p) => p.name)).toEqual(['Flat Banker', 'Martingale on Player', 'Count Dragon 7', 'Paroli on streaks', '1-3-2-6 Banker']);
    for (const preset of LAB_PRESETS) {
      const cfg = applyLabPreset(base, preset);
      expect(validateLabConfig(cfg, DEFAULT_RULES).errors).toEqual([]);
      expect(matchLabPreset(cfg)?.id).toBe(preset.id);
      expect(cfg.unit).toBe(base.unit);
      expect(cfg.seed).toBe(base.seed);
    }
    const martingale = applyLabPreset(base, LAB_PRESETS[1]);
    expect(martingale).toMatchObject({ selectorId: 'alwaysPlayer', systemId: 'martingale', systemParams: { maxDoublings: 8 } });
    const count = applyLabPreset(base, LAB_PRESETS[2]);
    expect(count).toMatchObject({ selectorId: 'alwaysBanker', systemId: 'flat', dragon7: 'count', panda8: 'never', sideUnits: 5 });
  });

  it('matchLabPreset ignores money and run size but sees any strategy edit', () => {
    const paroli = applyLabPreset(base, LAB_PRESETS[3]);
    expect(matchLabPreset({ ...paroli, unit: 25, trials: 50 })?.id).toBe('paroliStreaks');
    expect(matchLabPreset({ ...paroli, panda8: 'always' })).toBeNull();
    expect(matchLabPreset({ ...paroli, systemParams: { winsToReset: 2 } })).toBeNull();
    expect(matchLabPreset({ ...base, selectorId: 'random' })).toBeNull();
  });
});

describe('toSimConfig', () => {
  it('resolves the rules choice to a mutable copy and maps the optional stops', () => {
    const sim = toSimConfig({ ...base, rulesChoice: 'commission', stopLoss: 0, stopWin: 300 }, DEFAULT_RULES);
    expect(sim.rules.bankerRule).toBe('commission');
    expect(sim.rules).not.toBe(RULE_PRESETS.commission.rules);
    expect(sim.rules).toEqual(RULE_PRESETS.commission.rules);
    expect(Object.isFrozen(sim.rules)).toBe(false);
    expect(sim.stopLoss).toBeUndefined();
    expect(sim.stopWin).toBe(300);
    expect(sim.strategy.sideBets).toEqual({ dragon7: 'never', panda8: 'never', units: 1 });
    const custom = { ...DEFAULT_RULES, tiePays: 9 };
    expect(toSimConfig({ ...base, rulesChoice: 'current', stopLoss: 200 }, custom)).toMatchObject({ rules: { tiePays: 9 }, stopLoss: 200 });
    expect(resolveRules('super6', DEFAULT_RULES).bankerRule).toBe('super6');
  });

  it('normalises the system parameters to the system specs', () => {
    expect(normalizeSystemParams('martingale', { maxDoublings: 99, junk: 3 })).toEqual({ maxDoublings: 20 });
    expect(normalizeSystemParams('flat', { anything: 1 })).toEqual({});
    expect(normalizeSystemParams('labouchere')).toEqual({ length: 4 });
    const sim = toSimConfig({ ...base, systemId: 'martingale', systemParams: { maxDoublings: -4 } }, DEFAULT_RULES);
    expect(sim.strategy.systemParams).toEqual({ maxDoublings: 0 });
  });
});

describe('validateLabConfig', () => {
  it('reports errors that block the run', () => {
    expect(validateLabConfig({ ...base, trials: 0 }, DEFAULT_RULES).errors).toContain('Trials must be a positive whole number');
    expect(validateLabConfig({ ...base, trials: 1_000_000 }, DEFAULT_RULES).errors).toContain('Trials must be at most 100,000');
    expect(validateLabConfig({ ...base, shoesPerTrial: 501 }, DEFAULT_RULES).errors).toContain('Shoes per trial must be at most 500');
    expect(validateLabConfig({ ...base, selectorId: 'nope' }, DEFAULT_RULES).errors.join(' ')).toMatch(/Unknown bet selector/);
    expect(validateLabConfig({ ...base, unit: 0 }, DEFAULT_RULES).errors).toContain('Unit must be a positive amount');
    expect(validateLabConfig({ ...base, stopLoss: -1 }, DEFAULT_RULES).errors.join(' ')).toMatch(/Stop loss/);
  });

  it('warns about things that do not block the run', () => {
    const below = validateLabConfig({ ...base, unit: 5 }, DEFAULT_RULES);
    expect(below.errors).toEqual([]);
    expect(below.warnings).toEqual(['Unit $5 is below the table minimum of $10: main bets are placed at the minimum.']);
    expect(validateLabConfig({ ...base, unit: 6000 }, DEFAULT_RULES).warnings[0]).toMatch(/above the table maximum/);
    const ignored = validateLabConfig({ ...base, rulesChoice: 'commission', dragon7: 'count' }, DEFAULT_RULES);
    expect(ignored.warnings).toEqual(['Dragon 7 is not dealt on this table, so its policy is ignored.']);
    expect(validateLabConfig({ ...base, dragon7: 'always', sideUnits: 0 }, DEFAULT_RULES).warnings[0]).toMatch(/no Dragon 7 bets/);
    expect(validateLabConfig({ ...base, panda8: 'always', sideUnits: 100 }, DEFAULT_RULES).warnings[0]).toMatch(/capped at the \$500/);
    expect(validateLabConfig({ ...base, unit: 40, panda8: 'always', sideUnits: 0.1 }, DEFAULT_RULES).warnings[0]).toMatch(/raised to the \$5/);
    expect(validateLabConfig({ ...base, bankroll: 5 }, DEFAULT_RULES).warnings[0]).toMatch(/cannot cover/);
    expect(validateLabConfig({ ...base, stopLoss: 1000 }, DEFAULT_RULES).warnings[0]).toMatch(/stop loss is not below the bankroll/);
    const long = validateLabConfig({ ...base, trials: 100_000, shoesPerTrial: 10 }, DEFAULT_RULES);
    expect(long.errors).toEqual([]);
    expect(long.warnings[0]).toMatch(/take a while/);
  });
});

describe('estimateHands', () => {
  it('is close to the engine average of 81.5 hands per 8-deck shoe and about 60 for 6 decks', () => {
    expect(handsPerShoe(DEFAULT_RULES)).toBeGreaterThan(78);
    expect(handsPerShoe(DEFAULT_RULES)).toBeLessThan(84);
    expect(handsPerShoe({ ...DEFAULT_RULES, decks: 6 })).toBeGreaterThan(56);
    expect(handsPerShoe({ ...DEFAULT_RULES, decks: 6 })).toBeLessThan(63);
    expect(estimateHands({ trials: 100, shoesPerTrial: 2 }, DEFAULT_RULES)).toBeCloseTo(200 * handsPerShoe(DEFAULT_RULES), 0);
  });
});

describe('sanitizeLabConfig', () => {
  it('returns the defaults for garbage and keeps every valid field of a partial object', () => {
    expect(sanitizeLabConfig('nope', base)).toEqual(base);
    expect(sanitizeLabConfig(null, base)).toEqual(base);
    const out = sanitizeLabConfig({ selectorId: 'followLast', systemId: 'martingale', systemParams: { maxDoublings: 3 }, unit: '25', trials: 2.4, dragon7: 'count', rulesChoice: 'super6', seed: 7 }, base);
    expect(out).toMatchObject({ selectorId: 'followLast', systemId: 'martingale', systemParams: { maxDoublings: 3 }, unit: 25, trials: 2, dragon7: 'count', rulesChoice: 'super6', seed: 7, bankroll: 1000 });
  });

  it('falls back to the defaults for unknown ids, bad modes and out-of-range numbers', () => {
    const out = sanitizeLabConfig({ selectorId: 'x', systemId: 'y', dragon7: 'sometimes', rulesChoice: 'nope', trials: LAB_LIMITS.trials.max + 1, unit: -3, seed: 1e12 }, base);
    expect(out).toEqual(base);
  });
});
