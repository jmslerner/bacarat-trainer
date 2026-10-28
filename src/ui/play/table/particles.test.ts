// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CONFETTI_COLORS, EMBER_COLORS, lifeAlpha, runParticles, spawnConfetti, spawnEmber, stepConfetti, stepEmber } from './particles';

/** A deterministic stand-in for Math.random. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('the particle layer of the Dragon 7 / Panda 8 moment', () => {
  it('embers rise from the felt’s lower edge or around the banner, wherever the banner sits', () => {
    // First draw < 0.35: from the banner; the banner is at 70% of a 1000px felt here.
    const fromBanner = spawnEmber(800, 1000, seq(0.1, 0.5, 0.5), 0.7);
    expect(fromBanner.y).toBeCloseTo(1000 * (0.7 - 0.08 + 0.5 * 0.16), 6);
    expect(fromBanner.x).toBeGreaterThanOrEqual(800 * 0.32);
    expect(fromBanner.x).toBeLessThanOrEqual(800 * 0.68);
    expect(fromBanner.vy).toBeLessThan(0); // upward
    const fromEdge = spawnEmber(800, 1000, seq(0.9, 0.5, 0.5), 0.7);
    expect(fromEdge.y).toBeGreaterThanOrEqual(880);
    expect(EMBER_COLORS[fromEdge.color]).toBeDefined();
  });

  it('an ember drifts up and burns out within its life', () => {
    const p = spawnEmber(800, 1000, seq(0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
    const y0 = p.y;
    let alive = true;
    let steps = 0;
    while (alive && steps < 1000) {
      alive = stepEmber(p, 1 / 60);
      steps += 1;
    }
    expect(p.y).toBeLessThan(y0);
    expect(steps).toBeLessThanOrEqual(Math.ceil(p.life * 60) + 1);
  });

  it('confetti bursts upward from just above the banner, then falls under gravity and is dropped below the felt or when faded', () => {
    const p = spawnConfetti(800, 1000, seq(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5), 0.6);
    expect(p.y).toBe(600);
    expect(p.vy).toBeLessThan(0);
    expect(CONFETTI_COLORS[p.color]).toBeDefined();
    let minY = p.y;
    let alive = true;
    for (let i = 0; i < 600 && alive; i++) {
      alive = stepConfetti(p, 1 / 60, 1000);
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBeLessThan(600); // it went up first
    expect(alive).toBe(false);
    // Off the bottom of the felt it is dropped at once.
    const low = spawnConfetti(800, 1000, seq(0.5), 0.6);
    low.y = 1030;
    low.vy = 100;
    expect(stepConfetti(low, 1 / 60, 1000)).toBe(false);
  });

  it('fades in quickly and out slowly', () => {
    expect(lifeAlpha(0, 2)).toBe(0);
    expect(lifeAlpha(0.08, 2)).toBeCloseTo(0.5, 6);
    expect(lifeAlpha(0.5, 2)).toBe(1);
    expect(lifeAlpha(1.55, 2)).toBeCloseTo(0.5, 6);
    expect(lifeAlpha(2, 2)).toBeCloseTo(0, 9);
  });

  it('does nothing without a 2D context, and its stop function is safe to call', () => {
    const canvas = document.createElement('canvas');
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const stop = runParticles(canvas, 'dragon7', 2600, 0.5);
    expect(getContext).toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
    vi.restoreAllMocks();
  });
});
