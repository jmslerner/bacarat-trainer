/**
 * Counting drill logic (pure).
 *
 * The count systems are defined locally with the `CountSystem` shape of SPEC §5.3 (`{ id, name, description,
 * tags[0..9] by card value, threshold }`): the Dragon 7 tags are Jacobson's from SPEC §3; the Panda 8 tags mirror
 * the set derived in src/strategy (docs/COUNTING.md). Swap these for `DRAGON7_COUNT` / `PANDA8_COUNT` from
 * `@/strategy` once that module's barrel exists.
 */
import { buildDecks, cardValue } from '@/engine';
import type { Card, Rng } from '@/engine';
import { shuffled } from './seeds';

export interface DrillCountSystem {
  id: 'dragon7' | 'panda8';
  name: string;
  description: string;
  /** Tag per card VALUE: index 0 = 10/J/Q/K, 1 = Ace, 2..9. Balanced over the shoe. */
  tags: number[];
  /** Bet the side bet when the true count is at or above this. */
  threshold: number;
}

export const DRAGON7_COUNT: DrillCountSystem = Object.freeze({
  id: 'dragon7',
  name: 'Dragon 7 count',
  description: '4, 5, 6 and 7 count −1; 8 and 9 count +2; Ace, 2, 3 and the ten-value cards count 0. Bet the Dragon 7 at a true count of +4 or more.',
  tags: Object.freeze([0, 0, 0, 0, -1, -1, -1, -1, 2, 2]) as number[],
  threshold: 4,
}) as DrillCountSystem;

export const PANDA8_COUNT: DrillCountSystem = Object.freeze({
  id: 'panda8',
  name: 'Panda 8 count',
  description: 'Ten-value cards, Ace and 2 count +1; 3 and 8 count −2; 4, 5, 6 and 7 count −1; 9 counts +2. Bet the Panda 8 at a true count of +8 or more.',
  tags: Object.freeze([1, 1, 1, -2, -1, -1, -1, -1, -2, 2]) as number[],
  threshold: 8,
}) as DrillCountSystem;

export const DRILL_COUNT_SYSTEMS: readonly DrillCountSystem[] = [DRAGON7_COUNT, PANDA8_COUNT];

export function countSystemById(id: string): DrillCountSystem {
  return DRILL_COUNT_SYSTEMS.find((s) => s.id === id) ?? DRAGON7_COUNT;
}

export type CountPaceId = 'slow' | 'normal' | 'fast' | 'blitz';

export const COUNT_PACES: ReadonlyArray<{ id: CountPaceId; label: string; ms: number; hint: string }> = [
  { id: 'slow', label: 'Slow', ms: 1600, hint: 'One card every 1.6 s — learn the tags' },
  { id: 'normal', label: 'Normal', ms: 1000, hint: 'One card per second — a relaxed table' },
  { id: 'fast', label: 'Fast', ms: 650, hint: 'A brisk dealer' },
  { id: 'blitz', label: 'Blitz', ms: 400, hint: 'Faster than any dealer' },
];

export function paceMs(id: CountPaceId): number {
  return COUNT_PACES.find((p) => p.id === id)?.ms ?? 1000;
}

export const COUNT_LENGTHS: readonly number[] = [8, 16, 32, 52];

export const CARDS_PER_DECK = 52;

/** The first `count` cards of a freshly shuffled shoe (no replacement, so the deal is realistic). */
export function generateCountingCards(rng: Rng, count: number, decks = 8): Card[] {
  const shoe = shuffled(buildDecks(decks), (n) => rng.nextInt(n));
  return shoe.slice(0, Math.max(0, Math.min(count, shoe.length))).map((c, i) => ({ rank: c.rank, suit: c.suit, id: i }));
}

export function cardTagOf(card: Card, system: DrillCountSystem): number {
  return system.tags[cardValue(card.rank)];
}

export function runningCountOf(cards: readonly Card[], system: DrillCountSystem): number {
  let running = 0;
  for (const c of cards) running += cardTagOf(c, system);
  return running;
}

/** Running count after each card. */
export function cumulativeCounts(cards: readonly Card[], system: DrillCountSystem): number[] {
  const out: number[] = [];
  let running = 0;
  for (const c of cards) {
    running += cardTagOf(c, system);
    out.push(running);
  }
  return out;
}

/** True count = running ÷ max(decks remaining, 0.5), as the strategy module defines it. */
export function trueCountEstimate(running: number, cardsSeen: number, decks = 8): number {
  const remaining = Math.max(0, decks * CARDS_PER_DECK - cardsSeen) / CARDS_PER_DECK;
  return running / Math.max(remaining, 0.5);
}

/** "+3", "0", "−2" (unicode minus). */
export function formatCount(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${-n}`;
  return '0';
}

/** Parses "+3", "3", "-2", "−2". */
export function parseCountAnswer(text: string): number | null {
  const t = text.trim().replace(/−/g, '-').replace(/\s+/g, '');
  if (!/^[+-]?\d+$/.test(t)) return null;
  return Number(t);
}

/** Tags grouped for a legend: e.g. { tag: +2, values: [8, 9] }, highest tag first, zeros last. */
export function tagGroups(system: DrillCountSystem): { tag: number; values: number[] }[] {
  const groups = new Map<number, number[]>();
  system.tags.forEach((tag, value) => {
    const list = groups.get(tag) ?? [];
    list.push(value);
    groups.set(tag, list);
  });
  return [...groups.entries()]
    .map(([tag, values]) => ({ tag, values }))
    .sort((a, b) => (a.tag === 0 ? 1 : b.tag === 0 ? -1 : b.tag - a.tag));
}

/** "10/J/Q/K", "A", "2" … */
export function valueLabel(value: number): string {
  if (value === 0) return '10/J/Q/K';
  if (value === 1) return 'A';
  return String(value);
}
