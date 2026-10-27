import { describe, expect, it } from 'vitest';
import { CARD_SIZES } from '@/ui/shell';
import { MIN_CARD_WIDTH, fitCardWidth } from './cardFit';

describe('fitCardWidth', () => {
  it('keeps the nominal size while the area is unmeasured', () => {
    expect(fitCardWidth(0, 10, CARD_SIZES.lg)).toBe(92);
    expect(fitCardWidth(-5, 10, 70)).toBe(70);
  });
  it('fits two upright cards and a sideways third card into the area', () => {
    for (const [area, gap] of [
      [252, 10],
      [303, 10],
      [231, 6],
      [600, 10],
    ] as const) {
      const w = fitCardWidth(area, gap, CARD_SIZES.lg);
      expect(2 * w + Math.round(w * 1.4) + 2 * gap).toBeLessThanOrEqual(area + 1);
      expect(w).toBeLessThanOrEqual(CARD_SIZES.lg);
    }
    expect(fitCardWidth(252, 10, 92)).toBe(68); // a 1280px laptop
    expect(fitCardWidth(1000, 10, 92)).toBe(92); // wide desktops keep the large cards
  });
  it('never goes below the legible minimum', () => {
    expect(fitCardWidth(60, 10, 92)).toBe(MIN_CARD_WIDTH);
  });
});
