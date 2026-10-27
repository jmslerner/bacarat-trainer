import { describe, expect, it } from 'vitest';
import type { BetResult } from '@/engine';
import { BETTING_SYSTEMS, fibonacci, getSystem, paramValue } from './systems';

/** Plays a fixed result sequence and returns the bet BEFORE each result plus the bet after the last one. */
function play(id: string, results: string, params?: Record<string, number>, unit = 10): number[] {
  const system = getSystem(id);
  if (!system) throw new Error(`no system ${id}`);
  const state = system.create(unit, params);
  const map: Record<string, BetResult> = { W: 'win', L: 'lose', P: 'push' };
  const bets: number[] = [];
  for (const ch of results) {
    bets.push(state.nextBet());
    state.record(map[ch]);
  }
  bets.push(state.nextBet());
  return bets;
}

describe('betting systems', () => {
  it('exposes the SPEC list with params metadata', () => {
    expect(BETTING_SYSTEMS.map((s) => s.id)).toEqual(['flat', 'martingale', 'grandMartingale', 'paroli', 'oneThreeTwoSix', 'fibonacci', 'dAlembert', 'labouchere', 'oscarsGrind']);
    for (const s of BETTING_SYSTEMS) {
      expect(s.description.length).toBeGreaterThan(10);
      for (const p of s.params) {
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
      }
    }
    expect(getSystem('martingale')?.params.map((p) => p.key)).toEqual(['maxDoublings']);
    expect(getSystem('paroli')?.params.map((p) => p.key)).toEqual(['winsToReset']);
    expect(getSystem('labouchere')?.params.map((p) => p.key)).toEqual(['length']);
  });

  it('flat always bets one unit', () => {
    expect(play('flat', 'WLLPWL')).toEqual([10, 10, 10, 10, 10, 10, 10]);
  });

  it('martingale doubles after losses, resets after a win, and gives up after maxDoublings', () => {
    expect(play('martingale', 'LLLLWLW', { maxDoublings: 3 })).toEqual([10, 20, 40, 80, 10, 10, 20, 10]);
    expect(play('martingale', 'LLLLLLLLL')).toEqual([10, 20, 40, 80, 160, 320, 640, 1280, 2560, 10]); // default 8 doublings
    expect(play('martingale', 'LPL')).toEqual([10, 20, 20, 40]); // a push changes nothing
  });

  it('grand martingale doubles and adds a unit', () => {
    expect(play('grandMartingale', 'LLLW')).toEqual([10, 30, 70, 150, 10]);
  });

  it('paroli lets wins ride and resets after winsToReset or a loss', () => {
    expect(play('paroli', 'WWWWL')).toEqual([10, 20, 40, 10, 20, 10]);
    expect(play('paroli', 'WWL', { winsToReset: 5 })).toEqual([10, 20, 40, 10]);
    expect(play('paroli', 'WPW')).toEqual([10, 20, 20, 40]);
  });

  it('1-3-2-6 walks the sequence on wins and restarts on a loss or after the 6', () => {
    expect(play('oneThreeTwoSix', 'WWWW')).toEqual([10, 30, 20, 60, 10]);
    expect(play('oneThreeTwoSix', 'WLWWL')).toEqual([10, 30, 10, 30, 20, 10]);
  });

  it('fibonacci climbs one step per loss and drops two per win', () => {
    expect(play('fibonacci', 'LLLLWW')).toEqual([10, 10, 20, 30, 50, 20, 10]);
    expect(play('fibonacci', 'LLLLL', { maxSteps: 4 })).toEqual([10, 10, 20, 30, 50, 10]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(fibonacci)).toEqual([1, 1, 2, 3, 5, 8, 13, 21]);
  });

  it("d'Alembert adds a unit after a loss and removes one after a win, never below one unit", () => {
    expect(play('dAlembert', 'LLWWW')).toEqual([10, 20, 30, 20, 10, 10]);
  });

  it('labouchere bets first + last, crosses out on wins, appends on losses, restarts when the line is cleared', () => {
    expect(play('labouchere', 'WW')).toEqual([50, 50, 50]); // [1,2,3,4] → [2,3] → cleared → [1,2,3,4]
    expect(play('labouchere', 'LLWWW')).toEqual([50, 60, 70, 70, 70, 50]); // [1..4,5] [1..6] [2..5] [3,4] cleared
    expect(play('labouchere', 'W', { length: 1 })).toEqual([10, 10]);
    expect(play('labouchere', 'LW', { length: 1 })).toEqual([10, 20, 10]); // [1] → [1,1] → bet 2 → cleared
  });

  it("oscar's grind keeps the bet after a loss, raises one unit after a win and closes the cycle at +1 unit", () => {
    expect(play('oscarsGrind', 'LLWWW')).toEqual([10, 10, 10, 20, 10, 10]);
    // After L then W the cycle is at 0: the next bet is capped at 1 unit, which closes the cycle.
    expect(play('oscarsGrind', 'LWW')).toEqual([10, 10, 10, 10]);
    // Down 3 units: win 1 (−2) → bet 2; win 2 (0) → bet is capped at 1; win 1 (+1) → cycle closed.
    expect(play('oscarsGrind', 'LLLWWWW')).toEqual([10, 10, 10, 10, 20, 10, 10, 10]);
    // Down 4 units: win 1 (−3) → bet 2; win 2 (−1) → the raise to 3 is capped at 2, exactly what closes the cycle.
    expect(play('oscarsGrind', 'LLLLWW')).toEqual([10, 10, 10, 10, 10, 20, 20]);
  });

  it('pushes never move a progression and reset() returns to the base bet', () => {
    for (const system of BETTING_SYSTEMS) {
      const state = system.create(10);
      state.record('lose');
      state.record('lose');
      const afterLosses = state.nextBet();
      state.record('push');
      expect(state.nextBet()).toBe(afterLosses);
      state.reset();
      expect(state.nextBet()).toBe(system.id === 'labouchere' ? 50 : 10);
      expect(state.progressionIndex).toBe(system.id === 'labouchere' ? 4 : 0);
    }
  });

  it('progressionIndex reports the position in the progression', () => {
    const m = getSystem('martingale')!.create(10);
    m.record('lose');
    m.record('lose');
    expect(m.progressionIndex).toBe(2);
    const f = getSystem('fibonacci')!.create(10);
    f.record('lose');
    f.record('lose');
    f.record('lose');
    expect(f.progressionIndex).toBe(3);
  });

  it('paramValue falls back to the default and clamps to the allowed range', () => {
    const spec = getSystem('martingale')!.params[0];
    expect(paramValue(spec)).toBe(8);
    expect(paramValue(spec, { maxDoublings: Number.NaN })).toBe(8);
    expect(paramValue(spec, { maxDoublings: 3 })).toBe(3);
    expect(paramValue(spec, { maxDoublings: 99 })).toBe(20);
    expect(paramValue(spec, { maxDoublings: -5 })).toBe(0);
    expect(paramValue(spec, { maxDoublings: 2.6 })).toBe(3);
  });
});
