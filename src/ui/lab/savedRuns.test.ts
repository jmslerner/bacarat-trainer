// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultLabConfig } from './config';
import { MAX_SAVED_RUNS, clearRuns, removeRun, sanitizeSavedRuns, saveRun, savedRunsStore, summarizeResult, type SavedRun } from './savedRuns';
import { fakeResult } from './testHelpers';

const form = defaultLabConfig({ bankroll: 1000, seed: 3 });

function input(name: string) {
  return { name, rulesSummary: 'EZ Baccarat · 8 decks', form, summary: summarizeResult(fakeResult(), { low: 0.0102, high: 0.0102 }) };
}

beforeEach(() => {
  window.localStorage.clear();
  savedRunsStore.reset();
});

describe('saved runs', () => {
  it('summarizes a result without the curves', () => {
    const s = summarizeResult(fakeResult(), null);
    expect(s).toMatchObject({ trials: 100, shoesPerTrial: 10, bankroll: 1000, unit: 10, seed: 1, meanFinal: 917, pRuin: 0.02, expectedEdge: null, byOutcome: { tie: 7_708 } });
    expect('sampleCurves' in s).toBe(false);
  });

  it('persists under bt:lab, newest first, never more than six', () => {
    for (let i = 1; i <= MAX_SAVED_RUNS + 1; i++) saveRun(input(`run ${i}`));
    const runs = savedRunsStore.get();
    expect(runs).toHaveLength(MAX_SAVED_RUNS);
    expect(runs.map((r) => r.name)).toEqual(['run 7', 'run 6', 'run 5', 'run 4', 'run 3', 'run 2']);
    const stored = JSON.parse(window.localStorage.getItem('bt:lab') ?? '[]') as SavedRun[];
    expect(stored).toHaveLength(MAX_SAVED_RUNS);
    expect(stored[0].name).toBe('run 7');
    expect(stored[0].form.seed).toBe(3);
    expect(new Set(runs.map((r) => r.id)).size).toBe(MAX_SAVED_RUNS);
  });

  it('removes one run or clears them all', () => {
    const a = saveRun(input('a'));
    saveRun(input('b'));
    removeRun(a.id);
    expect(savedRunsStore.get().map((r) => r.name)).toEqual(['b']);
    removeRun('missing');
    expect(savedRunsStore.get()).toHaveLength(1);
    clearRuns();
    expect(savedRunsStore.get()).toEqual([]);
    expect(window.localStorage.getItem('bt:lab')).toBeNull();
  });

  it('drops anything in storage that is not a valid run', () => {
    const good = saveRun(input('good'));
    const raw: unknown[] = [good, { id: 'no-summary', savedAt: 1 }, 'text', null, { ...good, id: 'dup' }, { ...good, id: 'dup' }, { ...good, id: 'bad-summary', summary: { ...good.summary, pRuin: 'x' } }];
    const clean = sanitizeSavedRuns(raw);
    expect(clean.map((r) => r.id)).toEqual([good.id, 'dup']);
    expect(sanitizeSavedRuns('nope')).toEqual([]);
    expect(sanitizeSavedRuns(Array.from({ length: 10 }, (_, i) => ({ ...good, id: `r${i}` })))).toHaveLength(MAX_SAVED_RUNS);
    // An invalid form inside an otherwise valid run falls back to defaults instead of poisoning the entry.
    const odd = sanitizeSavedRuns([{ ...good, form: { selectorId: 'bogus', trials: 'ten' } }]);
    expect(odd[0].form.selectorId).toBe('alwaysBanker');
    expect(odd[0].form.trials).toBe(1000);
  });
});
