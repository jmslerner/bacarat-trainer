/**
 * The particle layer of the Dragon 7 / Panda 8 moment, drawn on a canvas the size of the felt.
 *
 *  - Dragon 7: embers rising from the bottom of the felt and from the banner, additive blending, warm palette;
 *  - Panda 8: a confetti burst from the banner in black, white and bamboo green, with gravity and flutter.
 *
 * `runParticles` starts the animation and returns a stop function; it is a no-op without a 2D context (jsdom,
 * reduced-motion callers never start it). The simulation steps are plain functions so they can be tested.
 */
import type { BonusKind } from '../animation/types';

export interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  age: number;
  sway: number;
  phase: number;
  color: number;
}

export interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  life: number;
  age: number;
  phase: number;
  color: number;
}

export const EMBER_COLORS: readonly string[] = ['#fff1c4', '#ffd27a', '#ffb347', '#ff8a3d', '#ff5a1f', '#f1d678'];
export const CONFETTI_COLORS: readonly string[] = ['#161616', '#ffffff', '#2fb36a', '#58d68d', '#e9e4f2', '#1c6b3b', '#f4f1ea'];

type Rng = () => number;

export function spawnEmber(w: number, h: number, rng: Rng = Math.random): Ember {
  // Two sources: the whole lower edge of the felt, and the banner's glow around the centre.
  const fromBanner = rng() < 0.35;
  const x = fromBanner ? w * (0.32 + rng() * 0.36) : w * (0.04 + rng() * 0.92);
  const y = fromBanner ? h * (0.42 + rng() * 0.16) : h * (0.88 + rng() * 0.12);
  return {
    x,
    y,
    vx: (rng() - 0.5) * 36,
    vy: -(55 + rng() * 150),
    r: 1.1 + rng() * 2.6,
    life: 1.3 + rng() * 1.5,
    age: 0,
    sway: 6 + rng() * 18,
    phase: rng() * Math.PI * 2,
    color: Math.floor(rng() * EMBER_COLORS.length),
  };
}

export function spawnConfetti(w: number, h: number, rng: Rng = Math.random): Confetti {
  const angle = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 1.25;
  const speed = 140 + rng() * 380;
  return {
    x: w * 0.5 + (rng() - 0.5) * w * 0.12,
    y: h * 0.42,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 60,
    w: 5 + rng() * 6,
    h: 3 + rng() * 4,
    rot: rng() * Math.PI,
    vr: (rng() - 0.5) * 16,
    life: 1.8 + rng() * 1.4,
    age: 0,
    phase: rng() * Math.PI * 2,
    color: Math.floor(rng() * CONFETTI_COLORS.length),
  };
}

/** Advances an ember by `dt` seconds; false once it has burnt out. */
export function stepEmber(p: Ember, dt: number): boolean {
  p.age += dt;
  if (p.age >= p.life) return false;
  p.vy -= 18 * dt; // embers accelerate upward a little as they rise
  p.x += (p.vx + Math.sin(p.phase + p.age * 3.2) * p.sway) * dt;
  p.y += p.vy * dt;
  return p.y > -12;
}

/** Advances a piece of confetti by `dt` seconds; false once it has fallen out of view or faded. */
export function stepConfetti(p: Confetti, dt: number, h: number): boolean {
  p.age += dt;
  if (p.age >= p.life) return false;
  p.vy += 640 * dt; // gravity
  const drag = Math.pow(0.22, dt); // air resistance (per second)
  p.vx *= drag;
  p.vy = p.vy > 0 ? Math.min(p.vy, 260) : p.vy * drag;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rot += p.vr * dt;
  return p.y < h + 20;
}

/** Opacity over a particle's life: a quick fade in and a long fade out. */
export function lifeAlpha(age: number, life: number): number {
  const k = age / life;
  if (k < 0.08) return k / 0.08;
  if (k > 0.55) return Math.max(0, 1 - (k - 0.55) / 0.45);
  return 1;
}

function emberSprites(ctx: CanvasRenderingContext2D): HTMLCanvasElement[] {
  // One soft sprite per colour: a radial falloff drawn once, then scaled per ember (cheap enough for 60 fps).
  return EMBER_COLORS.map((color) => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const g = c.getContext('2d') ?? ctx;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return c;
  });
}

export interface ParticleRun {
  /** Stops the animation and clears the canvas. */
  stop: () => void;
}

/**
 * Starts the layer for `kind`, spawning for the first part of `durationMs` and letting the last particles die
 * out after it. Returns the stop function (also used on unmount).
 */
export function runParticles(canvas: HTMLCanvasElement, kind: BonusKind, durationMs: number): () => void {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return () => undefined;
  const g = ctx;
  const host = canvas.parentElement ?? canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 1;
  let h = 1;
  const size = (): void => {
    const rect = host.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();

  const dragon = kind === 'dragon7';
  const embers: Ember[] = [];
  const confetti: Confetti[] = [];
  const sprites = dragon ? emberSprites(g) : [];
  const spawnUntil = durationMs * (dragon ? 0.62 : 0.12);
  const burstAt = [0, 220, 520];
  let bursts = 0;
  let spawnDebt = 0;
  let raf = 0;
  let stopped = false;
  let last: number | null = null;
  let elapsed = 0;

  const frame = (now: number): void => {
    if (stopped) return;
    const dt = last === null ? 1 / 60 : Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    elapsed += dt * 1000;
    g.clearRect(0, 0, w, h);

    if (dragon) {
      if (elapsed < spawnUntil) {
        spawnDebt += dt * 95;
        while (spawnDebt >= 1 && embers.length < 220) {
          embers.push(spawnEmber(w, h));
          spawnDebt -= 1;
        }
      }
      g.globalCompositeOperation = 'lighter';
      for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i];
        if (!stepEmber(p, dt)) {
          embers.splice(i, 1);
          continue;
        }
        const a = lifeAlpha(p.age, p.life) * (0.65 + 0.35 * Math.sin(p.phase * 3 + p.age * 11));
        const s = p.r * 6;
        g.globalAlpha = Math.max(0, Math.min(1, a));
        g.drawImage(sprites[p.color], p.x - s / 2, p.y - s / 2, s, s);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    } else {
      while (bursts < burstAt.length && elapsed >= burstAt[bursts]) {
        const n = bursts === 0 ? 110 : 70;
        for (let i = 0; i < n; i++) confetti.push(spawnConfetti(w, h));
        bursts += 1;
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        if (!stepConfetti(p, dt, h)) {
          confetti.splice(i, 1);
          continue;
        }
        g.globalAlpha = lifeAlpha(p.age, p.life);
        g.fillStyle = CONFETTI_COLORS[p.color];
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        // flutter: the piece turns about its long axis
        g.scale(1, Math.max(0.15, Math.abs(Math.cos(p.phase + p.age * 7))));
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      g.globalAlpha = 1;
    }

    const alive = dragon ? embers.length > 0 || elapsed < spawnUntil : confetti.length > 0 || bursts < burstAt.length;
    if (alive && elapsed < durationMs + 2500) raf = window.requestAnimationFrame(frame);
    else g.clearRect(0, 0, w, h);
  };
  raf = window.requestAnimationFrame(frame);
  window.addEventListener('resize', size);

  return () => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    try {
      g.clearRect(0, 0, w, h);
    } catch {
      /* ignore */
    }
  };
}
