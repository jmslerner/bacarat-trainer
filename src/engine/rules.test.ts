import { describe, expect, it } from 'vitest';
import { bankerDraws, cloneRules, DEFAULT_RULES, isNatural, MIN_CUT_CARD_FROM_END, playerDraws, RULE_PRESETS, validateRules } from './rules';
import type { TableRules } from './types';

/** SPEC §2 third-card table, written out literally: Banker total → Player third-card values on which Banker DRAWS. */
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

describe('third-card rules', () => {
  it('Player draws on 0–5 and stands on 6–7', () => {
    for (let t = 0; t <= 5; t++) expect(playerDraws(t)).toBe(true);
    expect(playerDraws(6)).toBe(false);
    expect(playerDraws(7)).toBe(false);
  });

  it('a natural is 8 or 9', () => {
    expect(isNatural(8)).toBe(true);
    expect(isNatural(9)).toBe(true);
    for (let t = 0; t <= 7; t++) expect(isNatural(t)).toBe(false);
  });

  it('Banker follows the table for every total and every Player third card', () => {
    for (let bankerTotal = 0; bankerTotal <= 7; bankerTotal++) {
      for (let p3 = 0; p3 <= 9; p3++) {
        const expected = BANKER_DRAWS_ON[bankerTotal].includes(p3);
        expect(bankerDraws(bankerTotal, p3), `banker ${bankerTotal} vs P3=${p3}`).toBe(expected);
      }
    }
  });

  it('when the Player stood, Banker draws on 0–5 and stands on 6–7', () => {
    for (let t = 0; t <= 5; t++) expect(bankerDraws(t, null)).toBe(true);
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(7, null)).toBe(false);
  });

  it('Banker never draws on a natural total', () => {
    for (let p3 = 0; p3 <= 9; p3++) {
      expect(bankerDraws(8, p3)).toBe(false);
      expect(bankerDraws(9, p3)).toBe(false);
    }
    expect(bankerDraws(8, null)).toBe(false);
  });
});

describe('rule sets', () => {
  it('DEFAULT_RULES is the 8-deck EZ table from the SPEC', () => {
    expect(DEFAULT_RULES.decks).toBe(8);
    expect(DEFAULT_RULES.bankerRule).toBe('ez');
    expect(DEFAULT_RULES.commissionRate).toBe(0.05);
    expect(DEFAULT_RULES.tiePays).toBe(8);
    expect(DEFAULT_RULES.dragon7Pays).toBe(40);
    expect(DEFAULT_RULES.panda8Pays).toBe(25);
    expect(DEFAULT_RULES.pairPays).toBe(11);
    expect(DEFAULT_RULES.sideBets).toEqual({ dragon7: true, panda8: true, pairs: true });
    expect(DEFAULT_RULES.limits).toEqual({ main: { min: 10, max: 5000 }, tie: { min: 5, max: 500 }, side: { min: 5, max: 500 } });
    expect(DEFAULT_RULES.cutCardFromEnd).toBe(14);
    expect(DEFAULT_RULES.burnProcedure).toBe(true);
    expect(DEFAULT_RULES.chipDenominations).toEqual([1, 5, 25, 100, 500, 1000]);
    expect(validateRules(DEFAULT_RULES)).toEqual([]);
  });

  it('defaults and presets are deeply frozen; cloneRules gives an editable deep copy', () => {
    expect(Object.isFrozen(DEFAULT_RULES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RULES.limits.main)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RULES.chipDenominations)).toBe(true);
    expect(Object.isFrozen(RULE_PRESETS.commission.rules.sideBets)).toBe(true);
    const copy = cloneRules(DEFAULT_RULES);
    expect(copy).toEqual(DEFAULT_RULES);
    expect(Object.isFrozen(copy)).toBe(false);
    copy.limits.main.min = 25;
    copy.chipDenominations.push(5000);
    copy.sideBets.panda8 = false;
    expect(DEFAULT_RULES.limits.main.min).toBe(10);
    expect(DEFAULT_RULES.chipDenominations).toHaveLength(6);
    expect(DEFAULT_RULES.sideBets.panda8).toBe(true);
  });

  it('presets are valid and differ only in the Banker rule and the EZ side bets', () => {
    expect(RULE_PRESETS.ez.rules).toBe(DEFAULT_RULES);
    expect(RULE_PRESETS.commission.rules.bankerRule).toBe('commission');
    expect(RULE_PRESETS.commission.rules.sideBets).toEqual({ dragon7: false, panda8: false, pairs: true });
    expect(RULE_PRESETS.super6.rules.bankerRule).toBe('super6');
    expect(RULE_PRESETS.super6.rules.sideBets).toEqual({ dragon7: false, panda8: false, pairs: true });
    for (const key of ['ez', 'commission', 'super6'] as const) {
      const preset = RULE_PRESETS[key];
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(validateRules(preset.rules)).toEqual([]);
      expect(preset.rules.decks).toBe(8);
      expect(preset.rules.limits).toEqual(DEFAULT_RULES.limits);
    }
  });

  it('validateRules reports every problem in plain language', () => {
    const bad = (patch: Partial<TableRules>): string[] => validateRules({ ...cloneRules(DEFAULT_RULES), ...patch });

    expect(bad({ decks: 7 as unknown as 8 })).toEqual(expect.arrayContaining([expect.stringMatching(/6 or 8/)]));
    expect(bad({ bankerRule: 'nope' as unknown as 'ez' })).toEqual(expect.arrayContaining([expect.stringMatching(/Banker rule/)]));
    expect(bad({ commissionRate: 0.5 })).toEqual(expect.arrayContaining([expect.stringMatching(/Commission/)]));
    expect(bad({ commissionRate: -0.01 })).toEqual(expect.arrayContaining([expect.stringMatching(/Commission/)]));
    expect(bad({ tiePays: 0 })).toEqual(expect.arrayContaining([expect.stringMatching(/Tie payout/)]));
    expect(bad({ dragon7Pays: Number.NaN })).toEqual(expect.arrayContaining([expect.stringMatching(/Dragon 7 payout/)]));
    expect(bad({ panda8Pays: -25 })).toEqual(expect.arrayContaining([expect.stringMatching(/Panda 8 payout/)]));
    expect(bad({ pairPays: 0 })).toEqual(expect.arrayContaining([expect.stringMatching(/Pair payout/)]));
    expect(bad({ sideBets: { dragon7: true, panda8: 'yes' as unknown as boolean, pairs: true } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/panda8/)]),
    );
    expect(bad({ limits: { main: { min: 100, max: 50 }, tie: { min: 5, max: 500 }, side: { min: 5, max: 500 } } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/Main bet maximum .* below the minimum/)]),
    );
    expect(bad({ limits: { main: { min: 10, max: 5000 }, tie: { min: 0, max: 500 }, side: { min: -5, max: 500 } } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/Tie bet minimum/), expect.stringMatching(/Side bet minimum/)]),
    );
    expect(bad({ cutCardFromEnd: MIN_CUT_CARD_FROM_END - 1 })).toEqual(expect.arrayContaining([expect.stringMatching(/at least 12 cards/)]));
    expect(bad({ cutCardFromEnd: 11.5 })).toEqual(expect.arrayContaining([expect.stringMatching(/Cut card/)]));
    expect(bad({ cutCardFromEnd: 400 })).toEqual(expect.arrayContaining([expect.stringMatching(/at least one deck/)]));
    expect(bad({ cutCardFromEnd: 12 })).toEqual([]);
    expect(bad({ cutCardFromEnd: 364 })).toEqual([]);
    expect(bad({ decks: 6, cutCardFromEnd: 261 })).toEqual(expect.arrayContaining([expect.stringMatching(/at least one deck/)]));
    expect(bad({ decks: 6, cutCardFromEnd: 260 })).toEqual([]);
    expect(bad({ burnProcedure: 'on' as unknown as boolean })).toEqual(expect.arrayContaining([expect.stringMatching(/Burn procedure/)]));
    expect(bad({ chipDenominations: [] })).toEqual(expect.arrayContaining([expect.stringMatching(/chip tray/)]));
    expect(bad({ chipDenominations: [5, 1] })).toEqual(expect.arrayContaining([expect.stringMatching(/ascending/)]));
    expect(bad({ chipDenominations: [1, 1] })).toEqual(expect.arrayContaining([expect.stringMatching(/ascending/)]));
    expect(bad({ chipDenominations: [1, 2.5] })).toEqual(expect.arrayContaining([expect.stringMatching(/whole number/)]));
    expect(validateRules(undefined as unknown as TableRules)).toEqual(['Rules are missing']);

    const many = bad({ decks: 5 as unknown as 8, tiePays: 0, cutCardFromEnd: 3 });
    expect(many.length).toBeGreaterThanOrEqual(3);
  });
});
