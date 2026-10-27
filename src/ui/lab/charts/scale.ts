/** Small, dependency-free scale helpers for the hand-rolled SVG charts. */

/** A "nice" number near `range` (Heckbert): 1, 2, 5 or 10 × 10^k. */
export function niceNum(range: number, round: boolean): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let nice: number;
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

export interface TickScale {
  /** Domain extended outward to whole ticks. */
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Round tick values covering [min, max] with about `maxTicks` ticks. */
export function niceTicks(min: number, max: number, maxTicks = 5): TickScale {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : lo + 1;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) {
    const pad = Math.max(1, Math.abs(lo) * 0.1);
    lo -= pad;
    hi += pad;
  }
  const range = niceNum(hi - lo, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const first = Math.floor(lo / step) * step;
  const last = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let v = first; v <= last + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/** A linear map from [d0, d1] to [r0, r1] (constant when the domain is empty). */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** Keeps `v` inside [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
