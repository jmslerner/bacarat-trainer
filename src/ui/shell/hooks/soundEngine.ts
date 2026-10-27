/**
 * Synthesized table sounds (Web Audio, no assets). Every public call is guarded: without an
 * AudioContext (jsdom, old browsers) or when the context fails, calls are silent no-ops.
 */

export type SoundName = 'chip' | 'deal' | 'flip' | 'win' | 'lose' | 'push' | 'bonus' | 'click' | 'shuffle';

export const SOUND_NAMES: readonly SoundName[] = ['chip', 'deal', 'flip', 'win', 'lose', 'push', 'bonus', 'click', 'shuffle'];

type Ctx = AudioContext;

/**
 * Browsers only let an AudioContext start after a user gesture, and Chromium logs a console warning when one is
 * created before that. The table plays its first sound (the opening shuffle) on page load, so sounds are dropped
 * until the page has seen a pointer or keyboard interaction.
 */
let activated = false;

function hasUserActivation(): boolean {
  if (activated) return true;
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }) : null;
    if (nav?.userActivation?.hasBeenActive === true) activated = true;
  } catch {
    /* ignore */
  }
  return activated;
}

function bindActivation(): void {
  if (typeof window === 'undefined') return;
  const mark = (): void => {
    activated = true;
  };
  try {
    for (const type of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(type, mark, { capture: true, passive: true });
  } catch {
    /* ignore */
  }
}

bindActivation();

interface ToneSpec {
  freq: number;
  endFreq?: number;
  type?: OscillatorType;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
}

interface NoiseSpec {
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: { type: BiquadFilterType; freq: number; endFreq?: number; q?: number };
}

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlockBound = false;
  private volume = 0.6;
  private lastPlayed = new Map<SoundName, number>();

  /** True when a context exists and is (or can be) running. */
  get available(): boolean {
    return this.ctx !== null;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) {
      try {
        this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
      } catch {
        /* ignore */
      }
    }
  }

  /** Create the context on demand (must happen during/after a user gesture to be audible). */
  private ensure(): Ctx | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => undefined);
      }
      return this.ctx;
    }
    if (!hasUserActivation()) return null;
    try {
      const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.bindUnlock();
      return ctx;
    } catch {
      return null;
    }
  }

  /** Resume a suspended context on the next user gesture (autoplay policies). */
  private bindUnlock(): void {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;
    const unlock = (): void => {
      try {
        this.ctx?.resume().catch(() => undefined);
      } catch {
        /* ignore */
      }
    };
    try {
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    } catch {
      /* ignore */
    }
  }

  private noise(ctx: Ctx): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private tone(ctx: Ctx, spec: ToneSpec): void {
    if (!this.master) return;
    const t0 = ctx.currentTime + (spec.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = spec.type ?? 'sine';
    osc.frequency.setValueAtTime(spec.freq, t0);
    if (spec.endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.endFreq), t0 + spec.dur);
    const g = ctx.createGain();
    const peak = spec.gain ?? 0.2;
    const attack = spec.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    let node: AudioNode = osc;
    if (spec.filter) {
      const f = ctx.createBiquadFilter();
      f.type = spec.filter.type;
      f.frequency.value = spec.filter.freq;
      if (spec.filter.q !== undefined) f.Q.value = spec.filter.q;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + spec.dur + 0.02);
  }

  private burst(ctx: Ctx, spec: NoiseSpec): void {
    if (!this.master) return;
    const t0 = ctx.currentTime + (spec.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const g = ctx.createGain();
    const peak = spec.gain ?? 0.3;
    const attack = spec.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    let node: AudioNode = src;
    if (spec.filter) {
      const f = ctx.createBiquadFilter();
      f.type = spec.filter.type;
      f.frequency.setValueAtTime(spec.filter.freq, t0);
      if (spec.filter.endFreq !== undefined) f.frequency.exponentialRampToValueAtTime(spec.filter.endFreq, t0 + spec.dur);
      if (spec.filter.q !== undefined) f.Q.value = spec.filter.q;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + spec.dur + 0.02);
  }

  play(name: SoundName): void {
    try {
      const ctx = this.ensure();
      if (!ctx) return;
      // Debounce identical sounds fired in the same frame (e.g. several chips at once).
      const now = ctx.currentTime;
      const last = this.lastPlayed.get(name);
      if (last !== undefined && now - last < 0.012) return;
      this.lastPlayed.set(name, now);
      this.synth(ctx, name);
    } catch {
      /* never throw from a sound */
    }
  }

  private synth(ctx: Ctx, name: SoundName): void {
    switch (name) {
      case 'chip':
        // two clay chips kissing: a bright click plus a short, dense clack
        this.burst(ctx, { dur: 0.045, gain: 0.5, filter: { type: 'bandpass', freq: 3400, q: 1.2 } });
        this.tone(ctx, { freq: 2600, endFreq: 1900, type: 'sine', dur: 0.05, gain: 0.12 });
        this.burst(ctx, { at: 0.03, dur: 0.035, gain: 0.28, filter: { type: 'bandpass', freq: 2200, q: 1.5 } });
        break;
      case 'deal':
        // card sliding across felt
        this.burst(ctx, { dur: 0.17, gain: 0.3, attack: 0.03, filter: { type: 'lowpass', freq: 500, endFreq: 3800, q: 0.7 } });
        this.burst(ctx, { at: 0.15, dur: 0.025, gain: 0.18, filter: { type: 'highpass', freq: 2500 } });
        break;
      case 'flip':
        // a snap: a very short high burst with a click
        this.burst(ctx, { dur: 0.04, gain: 0.4, filter: { type: 'highpass', freq: 1800 } });
        this.tone(ctx, { freq: 1500, endFreq: 700, type: 'triangle', dur: 0.04, gain: 0.08 });
        break;
      case 'click':
        this.tone(ctx, { freq: 900, endFreq: 700, type: 'sine', dur: 0.035, gain: 0.08 });
        break;
      case 'push':
        this.tone(ctx, { freq: 440, type: 'sine', dur: 0.14, gain: 0.1, attack: 0.01 });
        break;
      case 'win': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) =>
          this.tone(ctx, { freq: f, type: 'triangle', at: i * 0.085, dur: 0.32, gain: 0.16, attack: 0.01, filter: { type: 'lowpass', freq: 4000 } }),
        );
        break;
      }
      case 'lose':
        this.tone(ctx, { freq: 196, endFreq: 138, type: 'sawtooth', dur: 0.36, gain: 0.09, attack: 0.02, filter: { type: 'lowpass', freq: 700 } });
        this.tone(ctx, { freq: 98, endFreq: 70, type: 'sine', dur: 0.36, gain: 0.08, attack: 0.02 });
        break;
      case 'bonus': {
        // Dragon 7 / Panda 8: a sparkling run
        const run = [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98];
        run.forEach((f, i) => {
          this.tone(ctx, { freq: f, type: 'sine', at: i * 0.07, dur: 0.4, gain: 0.14, attack: 0.008 });
          this.tone(ctx, { freq: f * 2, type: 'triangle', at: i * 0.07, dur: 0.25, gain: 0.04, attack: 0.008 });
        });
        this.tone(ctx, { freq: 2093, type: 'sine', at: 0.5, dur: 0.6, gain: 0.1, attack: 0.02 });
        break;
      }
      case 'shuffle': {
        // a riffle: a train of short bursts that speeds up, then a final tap
        let t = 0;
        for (let i = 0; i < 16; i++) {
          this.burst(ctx, { at: t, dur: 0.03, gain: 0.22, filter: { type: 'bandpass', freq: 1500 + Math.random() * 800, q: 1 } });
          t += 0.065 - i * 0.002;
        }
        this.burst(ctx, { at: t + 0.1, dur: 0.06, gain: 0.3, filter: { type: 'lowpass', freq: 1200 } });
        break;
      }
      default:
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
