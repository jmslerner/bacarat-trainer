// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { getSession, resetSession, useSession } from './useSession';
import { rulesStore, buyInStore, prefsStore } from './useSettings';
import { DEFAULT_RULES, RULE_PRESETS, type TableRules } from '@/engine';
import { playSound, useSound } from './useSound';

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  prefsStore.reset();
  buyInStore.reset();
  resetSession({ bankroll: 1000, seed: 42 });
});
afterEach(cleanup);

describe('useSession', () => {
  it('exposes the singleton and re-renders on mutations', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.session).toBe(getSession());
    expect(result.current.state.bankroll).toBe(1000);
    act(() => {
      result.current.session.setBankroll(2500);
    });
    expect(result.current.state.bankroll).toBe(2500);
    expect(window.localStorage.getItem('bt:bankroll')).toBe('2500');
  });

  it('forwards rule changes from the settings store to the session (new shoe)', () => {
    const { result } = renderHook(() => useSession());
    const shoeBefore = result.current.state.shoe.shoeNumber;
    act(() => rulesStore.set(RULE_PRESETS.commission.rules));
    expect(result.current.state.rules.bankerRule).toBe('commission');
    expect(result.current.state.shoe.shoeNumber).toBe(shoeBefore + 1);
    expect(result.current.state.shoeHistory).toHaveLength(0);
  });

  it('re-saving identical rules (even with another key order) keeps the shoe and the bets on the layout', () => {
    const { result } = renderHook(() => useSession());
    act(() => {
      result.current.session.placeBet('banker', 25);
    });
    const shoeBefore = result.current.state.shoe.shoeNumber;
    const { decks, ...rest } = DEFAULT_RULES;
    const same = { ...rest, decks } as TableRules;
    act(() => rulesStore.set(same));
    expect(result.current.state.shoe.shoeNumber).toBe(shoeBefore);
    expect(result.current.state.bets).toEqual({ banker: 25 });
    act(() => rulesStore.set({ ...DEFAULT_RULES, tiePays: 9 }));
    expect(result.current.state.rules.tiePays).toBe(9);
    expect(result.current.state.shoe.shoeNumber).toBe(shoeBefore + 1);
    expect(result.current.state.bets).toEqual({});
  });

  it('resetSession with explicit rules leaves the persisted rules alone; invalid rules throw and keep the old session', () => {
    rulesStore.set(RULE_PRESETS.super6.rules);
    const s = resetSession({ rules: RULE_PRESETS.commission.rules, bankroll: 300 });
    expect(s.getState().rules.bankerRule).toBe('commission');
    expect(s.getState().bankroll).toBe(300);
    expect(rulesStore.get().bankerRule).toBe('super6');
    expect(() => resetSession({ rules: { ...DEFAULT_RULES, cutCardFromEnd: 1 } })).toThrow();
    expect(getSession()).toBe(s);
    expect(rulesStore.get().bankerRule).toBe('super6');
    // the bridge still serves the surviving session
    act(() => rulesStore.set({ ...DEFAULT_RULES, tiePays: 9 }));
    expect(s.getState().rules.tiePays).toBe(9);
  });

  it('falls back to the default rules when the persisted rules are unplayable', () => {
    rulesStore.set({ ...DEFAULT_RULES, cutCardFromEnd: 1 });
    const s = resetSession({ bankroll: 100 });
    expect(s.getState().rules).toEqual(DEFAULT_RULES);
    expect(rulesStore.get()).toEqual(DEFAULT_RULES);
    expect(window.localStorage.getItem('bt:rules')).toBeNull();
  });

  it('resetSession swaps the instance for subscribed components', () => {
    const { result } = renderHook(() => useSession());
    const old = result.current.session;
    act(() => {
      resetSession({ bankroll: 50 });
    });
    expect(result.current.session).not.toBe(old);
    expect(result.current.state.bankroll).toBe(50);
  });
});

describe('useSound', () => {
  it('never throws without an AudioContext and follows the sound pref', () => {
    expect(() => playSound('chip')).not.toThrow();
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(() => result.current.play('win')).not.toThrow();
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
  });
});
