// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SOUND_NAMES, soundEngine, type SoundName } from './soundEngine';

/* A minimal Web Audio stand-in that records what each sound builds. */
class FakeParam {
  value = 0;
  readonly values: number[] = [];
  setValueAtTime(v: number): this {
    this.values.push(v);
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    this.values.push(v);
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.values.push(v);
    return this;
  }
  setTargetAtTime(v: number): this {
    this.values.push(v);
    return this;
  }
}
class FakeNode {
  connect(): this {
    return this;
  }
  disconnect(): void {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  startedAt = 0;
  start(t: number): void {
    this.startedAt = t;
  }
  stop(): void {}
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  startedAt = 0;
  start(t: number): void {
    this.startedAt = t;
  }
  stop(): void {}
}
class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  sources: FakeSource[] = [];
  resume(): Promise<void> {
    return Promise.resolve();
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter();
  }
  createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

let ctx: FakeAudioContext | null = null;
const original = (globalThis as { AudioContext?: unknown }).AudioContext;

beforeAll(() => {
  (globalThis as { AudioContext?: unknown }).AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      ctx = this;
    }
  };
});
afterAll(() => {
  (globalThis as { AudioContext?: unknown }).AudioContext = original;
});

/** Plays a sound on a fresh clock and returns what it built. */
function play(name: SoundName): { oscillators: FakeOscillator[]; sources: FakeSource[] } {
  ctx!.currentTime += 10;
  const o0 = ctx!.oscillators.length;
  const s0 = ctx!.sources.length;
  soundEngine.play(name);
  return { oscillators: ctx!.oscillators.slice(o0), sources: ctx!.sources.slice(s0) };
}

describe('soundEngine', () => {
  it('names every sound, the side-bet moments included', () => {
    expect(SOUND_NAMES).toContain('bonus');
    expect(SOUND_NAMES).toContain('riser');
    expect(SOUND_NAMES).toContain('dragon7');
    expect(SOUND_NAMES).toContain('panda8');
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
  });

  it('stays silent until the page has seen a user gesture, then builds a context on the first play', () => {
    expect(soundEngine.available).toBe(false);
    soundEngine.play('chip');
    expect(soundEngine.available).toBe(false);
    expect(ctx).toBeNull();
    window.dispatchEvent(new Event('pointerdown'));
    soundEngine.play('chip');
    expect(soundEngine.available).toBe(true);
    expect(ctx).not.toBeNull();
  });

  it('synthesizes every named sound without throwing, each from at least one source', () => {
    for (const name of SOUND_NAMES) {
      const built = play(name);
      expect(built.oscillators.length + built.sources.length, name).toBeGreaterThan(0);
    }
    expect(() => soundEngine.play('nothing' as SoundName)).not.toThrow();
  });

  it('the Dragon 7 is a low gong followed by a rising run; the Panda 8 a bright cascade; the riser a quickening roll', () => {
    const dragon = play('dragon7');
    const firstFreq = (o: FakeOscillator): number => o.frequency.values[0];
    const boom = dragon.oscillators.filter((o) => firstFreq(o) < 100 && o.startedAt < ctx!.currentTime + 0.05);
    expect(boom.length).toBeGreaterThan(0);
    const run = dragon.oscillators.filter((o) => o.type === 'triangle' && o.startedAt > ctx!.currentTime + 0.3 && firstFreq(o) >= 392);
    expect(run.length).toBeGreaterThanOrEqual(8);
    const runFreqs = run.sort((a, b) => a.startedAt - b.startedAt).map(firstFreq);
    expect(runFreqs.slice(0, 8)).toEqual([...runFreqs.slice(0, 8)].sort((a, b) => a - b)); // ascending
    expect(dragon.sources.length).toBeGreaterThan(0); // the strike

    const panda = play('panda8');
    const bells = panda.oscillators.filter((o) => firstFreq(o) >= 700);
    expect(bells.length).toBeGreaterThanOrEqual(9);
    expect(panda.oscillators.some((o) => firstFreq(o) < 100)).toBe(false); // no boom in a Panda
    const starts = bells.map((o) => o.startedAt);
    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThan(0.5); // a cascade, not a chord

    const riser = play('riser');
    expect(riser.sources.length).toBeGreaterThanOrEqual(12);
    const taps = riser.sources
      .slice(0, 12)
      .map((s) => s.startedAt)
      .sort((a, b) => a - b);
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]); // quickening
    expect(Math.max(...riser.sources.map((s) => s.startedAt)) - ctx!.currentTime).toBeLessThan(1.2);

    const bonus = play('bonus');
    expect(bonus.sources).toHaveLength(0); // the pair / natural sparkle is tones only
    expect(bonus.oscillators.length).toBeLessThan(dragon.oscillators.length);
  });

  it('debounces the same sound fired twice in one frame', () => {
    ctx!.currentTime += 10;
    const before = ctx!.oscillators.length;
    soundEngine.play('click');
    soundEngine.play('click');
    expect(ctx!.oscillators.length - before).toBe(1);
  });
});
