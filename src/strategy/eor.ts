/**
 * Deriving a counting system from an effect-of-removal (EOR) table.
 *
 * A count assigns an integer tag to each card value. Its quality as a betting indicator is the betting
 * correlation: the Pearson correlation, across the physical cards of the shoe, between the tag and the EOR of
 * each card. In an 8-deck shoe there are 128 zero-value cards (10/J/Q/K) and 32 of every other value, so the
 * correlation is weighted by those multiplicities. A count is balanced when its tags sum to zero over the shoe,
 * so the running count returns to zero at the end of every shoe.
 */

export type CardValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const CARD_VALUE_LABELS: readonly string[] = Object.freeze(['10/J/Q/K', 'A', '2', '3', '4', '5', '6', '7', '8', '9']);

/** Number of cards of each value (index 0..9) in a shoe of `decks` decks. */
export function cardMultiplicities(decks = 8): number[] {
  const m = new Array<number>(10).fill(4 * decks);
  m[0] = 16 * decks;
  return m;
}

function assertTags(tags: readonly number[]): void {
  if (tags.length !== 10) throw new RangeError(`A tag set needs 10 entries (card values 0..9), got ${tags.length}`);
}

/** Sum of tags over the whole shoe (0 for a balanced count). */
export function shoeSum(tags: readonly number[], decks = 8): number {
  assertTags(tags);
  const m = cardMultiplicities(decks);
  let sum = 0;
  for (let v = 0; v < 10; v++) sum += m[v] * tags[v];
  return sum;
}

export function isBalanced(tags: readonly number[], decks = 8): boolean {
  return shoeSum(tags, decks) === 0;
}

/**
 * Betting correlation of a tag set with an EOR vector: Pearson correlation over the cards of the shoe
 * (multiplicity-weighted, both series centred). 1 = the tags are exactly proportional to the EORs.
 */
export function bettingCorrelation(tags: readonly number[], eor: readonly number[], decks = 8): number {
  assertTags(tags);
  assertTags(eor);
  const m = cardMultiplicities(decks);
  let total = 0;
  let meanT = 0;
  let meanE = 0;
  for (let v = 0; v < 10; v++) {
    total += m[v];
    meanT += m[v] * tags[v];
    meanE += m[v] * eor[v];
  }
  meanT /= total;
  meanE /= total;
  let num = 0;
  let sumT2 = 0;
  let sumE2 = 0;
  for (let v = 0; v < 10; v++) {
    const t = tags[v] - meanT;
    const e = eor[v] - meanE;
    num += m[v] * t * e;
    sumT2 += m[v] * t * t;
    sumE2 += m[v] * e * e;
  }
  if (sumT2 === 0 || sumE2 === 0) return 0;
  return num / Math.sqrt(sumT2 * sumE2);
}

export interface TagSetCandidate {
  tags: number[];
  correlation: number;
  /** Largest |tag|. */
  level: number;
  /** Number of card values with a non-zero tag. */
  nonZero: number;
}

export function describeTagSet(tags: readonly number[]): Pick<TagSetCandidate, 'level' | 'nonZero'> {
  let level = 0;
  let nonZero = 0;
  for (const t of tags) {
    level = Math.max(level, Math.abs(t));
    if (t !== 0) nonZero += 1;
  }
  return { level, nonZero };
}

/** "10/J/Q/K +1, A +1, 2 +1, 3 −2, …" (zero tags omitted). */
export function formatTags(tags: readonly number[]): string {
  const parts: string[] = [];
  for (let v = 0; v < 10; v++) {
    if (tags[v] === 0) continue;
    parts.push(`${CARD_VALUE_LABELS[v]} ${tags[v] > 0 ? '+' : '−'}${Math.abs(tags[v])}`);
  }
  return parts.length === 0 ? 'all zero' : parts.join(', ');
}

export interface TagSearchOptions {
  decks?: number;
  /** How many of the best candidates to return (default 10). */
  limit?: number;
}

/**
 * Exhaustive search of every balanced tag set with tags in [−maxTag, +maxTag], ranked by betting correlation.
 * Each set is reported once with its leading non-zero tag positive (a count and its negation are the same system).
 * (2·maxTag + 1)^9 combinations: instant at level 2, about a second at level 3 in node.
 */
export function searchBalancedTagSets(eor: readonly number[], maxTag: number, options: TagSearchOptions = {}): TagSetCandidate[] {
  assertTags(eor);
  if (!Number.isInteger(maxTag) || maxTag < 1) throw new RangeError('maxTag must be a positive integer');
  const decks = options.decks ?? 8;
  const limit = options.limit ?? 10;
  const m = cardMultiplicities(decks);
  const ratio = m[0] / m[1]; // zero-value cards per card of any other value (4)

  // Centre the EORs once; a balanced tag set already has a zero weighted mean.
  let total = 0;
  let meanE = 0;
  for (let v = 0; v < 10; v++) {
    total += m[v];
    meanE += m[v] * eor[v];
  }
  meanE /= total;
  const e = eor.map((x) => x - meanE);
  let sumE2 = 0;
  for (let v = 0; v < 10; v++) sumE2 += m[v] * e[v] * e[v];

  const best: TagSetCandidate[] = [];
  const tags = new Array<number>(10).fill(-maxTag); // odometer over values 1..9; tags[0] is implied by balance
  const consider = (): void => {
    const sum = tags[1] + tags[2] + tags[3] + tags[4] + tags[5] + tags[6] + tags[7] + tags[8] + tags[9];
    if (sum % ratio !== 0) return;
    const t0 = sum === 0 ? 0 : -sum / ratio; // avoid -0
    if (t0 < -maxTag || t0 > maxTag) return;
    tags[0] = t0;
    let num = 0;
    let sumT2 = 0;
    for (let v = 0; v < 10; v++) {
      num += m[v] * tags[v] * e[v];
      sumT2 += m[v] * tags[v] * tags[v];
    }
    if (sumT2 === 0) return;
    const correlation = num / Math.sqrt(sumT2 * sumE2);
    if (correlation <= 0) return; // the negated set is reported instead
    if (best.length === limit && correlation <= best[best.length - 1].correlation) return;
    const candidate: TagSetCandidate = { tags: tags.slice(), correlation, ...describeTagSet(tags) };
    let i = best.length;
    while (i > 0 && best[i - 1].correlation < correlation) i--;
    best.splice(i, 0, candidate);
    if (best.length > limit) best.pop();
  };

  for (;;) {
    consider();
    let v = 9;
    while (v >= 1) {
      if (tags[v] < maxTag) {
        tags[v] += 1;
        break;
      }
      tags[v] = -maxTag;
      v -= 1;
    }
    if (v < 1) break;
  }
  return best;
}
