// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { DEFAULT_RULES, RULE_PRESETS, type TableRules } from '@/engine';
import { createPersistedStore, readStorage, useLocalStorage, writeStorage, __resetStoresForTests } from './storage';
import { buyInStore, prefsStore, rulesStore, rulesEqual, sanitizePrefs, sanitizeRules, useSettings, DEFAULT_PREFS, matchPreset } from './useSettings';

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  prefsStore.reset();
  buyInStore.reset();
});
afterEach(cleanup);

describe('storage primitives', () => {
  it('reads and writes JSON under bt: keys', () => {
    expect(writeStorage('thing', { a: 1 })).toBe(true);
    expect(window.localStorage.getItem('bt:thing')).toBe('{"a":1}');
    expect(readStorage('thing', null)).toEqual({ a: 1 });
    expect(readStorage('missing', 'fallback')).toBe('fallback');
    window.localStorage.setItem('bt:broken', '{not json');
    expect(readStorage('broken', 'fallback')).toBe('fallback');
  });

  it('useLocalStorage shares state across hooks with the same key and persists', () => {
    const a = renderHook(() => useLocalStorage('shared-counter', 0));
    const b = renderHook(() => useLocalStorage('shared-counter', 0));
    expect(a.result.current[0]).toBe(0);
    act(() => a.result.current[1](5));
    expect(a.result.current[0]).toBe(5);
    expect(b.result.current[0]).toBe(5);
    expect(window.localStorage.getItem('bt:shared-counter')).toBe('5');
    act(() => b.result.current[1]((n) => n + 1));
    expect(a.result.current[0]).toBe(6);
    act(() => a.result.current[2]());
    expect(b.result.current[0]).toBe(0);
    expect(window.localStorage.getItem('bt:shared-counter')).toBeNull();
  });

  it('hydrates a store from storage and sanitizes stale shapes', () => {
    __resetStoresForTests();
    window.localStorage.setItem('bt:fresh', JSON.stringify({ x: 'bad' }));
    const store = createPersistedStore<{ x: number }>('fresh', { x: 1 }, { sanitize: (raw, d) => (typeof raw === 'object' && raw && typeof (raw as { x: unknown }).x === 'number' ? (raw as { x: number }) : d) });
    expect(store.get()).toEqual({ x: 1 });
    store.set({ x: 9 });
    expect(JSON.parse(window.localStorage.getItem('bt:fresh') ?? '')).toEqual({ x: 9 });
    __resetStoresForTests();
    const again = createPersistedStore<{ x: number }>('fresh', { x: 1 });
    expect(again.get()).toEqual({ x: 9 });
  });
});

describe('sanitizers', () => {
  it('sanitizeRules fills missing/invalid fields from the defaults', () => {
    expect(sanitizeRules(undefined)).toEqual(DEFAULT_RULES);
    const r = sanitizeRules({ decks: 7, bankerRule: 'weird', tiePays: '9', limits: { main: { min: -5, max: 50 } }, chipDenominations: [5, 'x', 5, 1] });
    expect(r.decks).toBe(DEFAULT_RULES.decks);
    expect(r.bankerRule).toBe(DEFAULT_RULES.bankerRule);
    expect(r.tiePays).toBe(9);
    expect(r.limits.main).toEqual({ min: DEFAULT_RULES.limits.main.min, max: 50 });
    expect(r.limits.tie).toEqual(DEFAULT_RULES.limits.tie);
    expect(r.chipDenominations).toEqual([1, 5]);
    expect(r.sideBets).toEqual(DEFAULT_RULES.sideBets);
  });
  it('rulesEqual and matchPreset ignore key order but see every difference', () => {
    const { decks, limits, ...rest } = DEFAULT_RULES;
    const reordered = { ...rest, limits: { side: limits.side, tie: limits.tie, main: limits.main }, decks } as TableRules;
    expect(rulesEqual(reordered, DEFAULT_RULES)).toBe(true);
    expect(matchPreset(reordered)).toBe('ez');
    expect(rulesEqual({ ...DEFAULT_RULES, chipDenominations: [1, 5] }, DEFAULT_RULES)).toBe(false);
    expect(rulesEqual({ ...DEFAULT_RULES, sideBets: { ...DEFAULT_RULES.sideBets, pairs: false } }, DEFAULT_RULES)).toBe(false);
    expect(rulesEqual({ ...DEFAULT_RULES, limits: { ...DEFAULT_RULES.limits, tie: { min: 5, max: 501 } } }, DEFAULT_RULES)).toBe(false);
  });
  it('sanitizePrefs keeps only known speeds and booleans', () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ sound: 'yes', dealSpeed: 'warp', showCoach: false })).toEqual({ ...DEFAULT_PREFS, showCoach: false });
    expect(sanitizePrefs({ dealSpeed: 'instant' }).dealSpeed).toBe('instant');
  });
});

describe('useSettings', () => {
  it('starts from the defaults and persists rule changes', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.rules).toEqual(DEFAULT_RULES);
    expect(result.current.prefs).toEqual(DEFAULT_PREFS);
    expect(result.current.buyIn).toBe(1000);

    act(() => result.current.applyPreset('commission'));
    expect(result.current.rules.bankerRule).toBe('commission');
    expect(matchPreset(result.current.rules)).toBe('commission');
    expect(JSON.parse(window.localStorage.getItem('bt:rules') ?? '{}').bankerRule).toBe('commission');

    act(() => {
      expect(result.current.setRules({ ...RULE_PRESETS.ez.rules, tiePays: 9 })).toEqual([]);
    });
    expect(result.current.rules.tiePays).toBe(9);
    expect(matchPreset(result.current.rules)).toBeNull();

    let problems: string[] = [];
    act(() => {
      problems = result.current.setRules({ ...RULE_PRESETS.ez.rules, cutCardFromEnd: 2 });
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(result.current.rules.tiePays).toBe(9); // invalid rules are not persisted
  });

  it('persists prefs and buy-in, and toggles', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setPrefs({ dealSpeed: 'fast', beginnerTips: false }));
    expect(result.current.prefs).toEqual({ ...DEFAULT_PREFS, dealSpeed: 'fast', beginnerTips: false });
    act(() => result.current.togglePref('sound'));
    expect(result.current.prefs.sound).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('bt:prefs') ?? '{}')).toEqual({ ...DEFAULT_PREFS, dealSpeed: 'fast', beginnerTips: false, sound: false });
    act(() => result.current.setBuyIn(2500));
    expect(result.current.buyIn).toBe(2500);
    expect(window.localStorage.getItem('bt:buyIn')).toBe('2500');
    act(() => result.current.resetAll());
    expect(result.current.rules).toEqual(DEFAULT_RULES);
    expect(result.current.prefs).toEqual(DEFAULT_PREFS);
    expect(result.current.buyIn).toBe(1000);
  });

  it('two hooks see the same settings', () => {
    const a = renderHook(() => useSettings());
    const b = renderHook(() => useSettings());
    act(() => a.result.current.setPrefs({ showCoach: false }));
    expect(b.result.current.prefs.showCoach).toBe(false);
  });
});
