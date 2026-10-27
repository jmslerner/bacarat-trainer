/**
 * FrameRunner — schedules a timeline of frames with timers, applying them in order.
 *
 *  - frames at 0 ms are applied synchronously inside `start()` (instant speed = the whole hand at once);
 *  - `skip()` fast-forwards: every pending frame is applied immediately, in order;
 *  - `cancel()` drops the pending frames without applying them (unmount, reset).
 */
import type { Frame } from './types';

export interface FrameRunnerOptions {
  apply: (frame: Frame, instant: boolean) => void;
  onDone?: () => void;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export class FrameRunner {
  private frames: Frame[] = [];
  private next = 0;
  private timers: number[] = [];
  private readonly apply: FrameRunnerOptions['apply'];
  private readonly onDone: () => void;
  private readonly setTimer: (fn: () => void, ms: number) => number;
  private readonly clearTimer: (id: number) => void;

  constructor(opts: FrameRunnerOptions) {
    this.apply = opts.apply;
    this.onDone = opts.onDone ?? (() => undefined);
    this.setTimer = opts.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((id) => window.clearTimeout(id));
  }

  /** True while frames are still pending. */
  get active(): boolean {
    return this.next < this.frames.length;
  }

  /** Replaces whatever is running with a new timeline. */
  start(frames: readonly Frame[]): void {
    this.cancel();
    this.frames = [...frames].sort((a, b) => a.at - b.at);
    this.next = 0;
    while (this.next < this.frames.length && this.frames[this.next].at <= 0) {
      const frame = this.frames[this.next++];
      this.apply(frame, this.frames.every((f) => f.at <= 0));
    }
    if (!this.active) {
      this.finish();
      return;
    }
    for (let i = this.next; i < this.frames.length; i++) {
      const frame = this.frames[i];
      this.timers.push(
        this.setTimer(() => {
          if (this.frames[this.next] !== frame) return; // stale timer after a skip/cancel
          this.next++;
          this.apply(frame, false);
          if (!this.active) this.finish();
        }, frame.at),
      );
    }
  }

  /** Applies every pending frame now. */
  skip(): void {
    if (!this.active) return;
    this.clearTimers();
    while (this.next < this.frames.length) {
      const frame = this.frames[this.next++];
      this.apply(frame, true);
    }
    this.finish();
  }

  /** Drops the pending frames (nothing more is applied, onDone is not called). */
  cancel(): void {
    this.clearTimers();
    this.frames = [];
    this.next = 0;
  }

  private finish(): void {
    this.clearTimers();
    this.frames = [];
    this.next = 0;
    this.onDone();
  }

  private clearTimers(): void {
    for (const id of this.timers) this.clearTimer(id);
    this.timers = [];
  }
}
