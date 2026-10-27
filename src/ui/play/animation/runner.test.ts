import { describe, expect, it } from 'vitest';
import { FrameRunner } from './runner';
import type { Frame } from './types';

/** A hand-driven timer so the tests need no fake globals. */
function makeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimer: (fn: () => void, ms: number): number => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (id: number): void => {
      timers.delete(id);
    },
    advance(ms: number): void {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
        if (due.length === 0) break;
        const [id, t] = due[0];
        timers.delete(id);
        now = t.at;
        t.fn();
      }
      now = target;
    },
    get pending(): number {
      return timers.size;
    },
  };
}

const frames: Frame[] = [
  { at: 0, bankroll: 1 },
  { at: 0, bankroll: 2 },
  { at: 100, bankroll: 3 },
  { at: 250, bankroll: 4, event: 'done' },
];

describe('FrameRunner', () => {
  it('applies frames at 0 synchronously and the rest on time, then reports done', () => {
    const clock = makeClock();
    const applied: Array<[number, boolean]> = [];
    let done = 0;
    const runner = new FrameRunner({ apply: (f, instant) => applied.push([f.bankroll!, instant]), onDone: () => done++, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
    runner.start(frames);
    expect(applied).toEqual([
      [1, false],
      [2, false],
    ]);
    expect(runner.active).toBe(true);
    clock.advance(100);
    expect(applied.map(([b]) => b)).toEqual([1, 2, 3]);
    expect(done).toBe(0);
    clock.advance(200);
    expect(applied.map(([b]) => b)).toEqual([1, 2, 3, 4]);
    expect(done).toBe(1);
    expect(runner.active).toBe(false);
    expect(clock.pending).toBe(0);
  });

  it('flags an all-instant timeline and finishes at once', () => {
    const clock = makeClock();
    const applied: Array<[number, boolean]> = [];
    let done = 0;
    const runner = new FrameRunner({ apply: (f, instant) => applied.push([f.bankroll!, instant]), onDone: () => done++, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
    runner.start(frames.map((f) => ({ ...f, at: 0 })));
    expect(applied).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, true],
    ]);
    expect(done).toBe(1);
    expect(runner.active).toBe(false);
  });

  it('skip applies the pending frames in order and cancel drops them', () => {
    const clock = makeClock();
    const applied: number[] = [];
    let done = 0;
    const runner = new FrameRunner({ apply: (f) => applied.push(f.bankroll!), onDone: () => done++, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
    runner.start(frames);
    clock.advance(50);
    runner.skip();
    expect(applied).toEqual([1, 2, 3, 4]);
    expect(done).toBe(1);
    expect(clock.pending).toBe(0);
    runner.skip(); // no-op when idle
    expect(done).toBe(1);

    runner.start(frames);
    runner.cancel();
    clock.advance(1000);
    expect(applied).toEqual([1, 2, 3, 4, 1, 2]);
    expect(done).toBe(1);
    expect(runner.active).toBe(false);
  });

  it('starting a new timeline replaces the running one', () => {
    const clock = makeClock();
    const applied: number[] = [];
    const runner = new FrameRunner({ apply: (f) => applied.push(f.bankroll!), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
    runner.start(frames);
    runner.start([{ at: 0, bankroll: 10 }, { at: 40, bankroll: 11 }]);
    clock.advance(1000);
    expect(applied).toEqual([1, 2, 10, 11]);
  });
});
