/**
 * The card width that lets two upright cards and a sideways third card sit in a hand area of a given width:
 * `2w + 1.4w + 2 gaps ≤ width`, clamped between a legible minimum and the breakpoint's nominal size.
 * An unmeasured area (width 0, e.g. before the first layout or in jsdom) keeps the nominal size.
 */
import { CARD_ASPECT } from '@/ui/shell';

export const MIN_CARD_WIDTH = 40;

export function fitCardWidth(areaWidth: number, gap: number, max: number, min = MIN_CARD_WIDTH): number {
  if (!(areaWidth > 0)) return max;
  const fit = Math.floor((areaWidth - 2 * Math.max(0, gap)) / (2 + CARD_ASPECT));
  return Math.max(min, Math.min(max, fit));
}
