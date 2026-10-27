/**
 * Counting drill logic (pure).
 *
 * The count systems ARE the `@/strategy` ones (`DRAGON7_COUNT` = Jacobson's tags from SPEC §3, `PANDA8_COUNT` =
 * the count derived and validated in docs/COUNTING.md), re-exported with their ids narrowed, and the running /
 * true counts delegate to the strategy module so the drill, the lessons and the Coach teach exactly one count.
 */
import { buildDecks } from '@/engine';
import type { Card, Rng } from '@/engine';
import { CARDS_PER_DECK, DRAGON7_COUNT as STRATEGY_DRAGON7_COUNT, PANDA8_COUNT as STRATEGY_PANDA8_COUNT, cardTag, runningCount, trueCount } from '@/strategy';
import type { CountSystem } from '@/strategy';
import { shuffled } from './seeds';

export type DrillCountSystemId = 'dragon7' | 'panda8';

/** A `@/strategy` CountSystem (SPEC §5.3) whose id is one of the two side-bet counts. */
export interface DrillCountSystem extends CountSystem {
  id: DrillCountSystemId;
}

function asDrillSystem(system: CountSystem, id: DrillCountSystemId): DrillCountSystem {
  if (system.id !== id) throw new Error(`@/strategy count system "${system.id}" is not the ${id} count`);
  return system as DrillCountSystem;
}

export const DRAGON7_COUNT: DrillCountSystem = asDrillSystem(STRATEGY_DRAGON7_COUNT, 'dragon7');
export const PANDA8_COUNT: DrillCountSystem = asDrillSystem(STRATEGY_PANDA8_COUNT, 'panda8');

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

export { CARDS_PER_DECK };

/** The first `count` cards of a freshly shuffled `decks`-deck shoe (no replacement, so the deal is realistic). */
export function generateCountingCards(rng: Rng, count: number, decks = 8): Card[] {
  const shoe = shuffled(buildDecks(decks), (n) => rng.nextInt(n));
  return shoe.slice(0, Math.max(0, Math.min(count, shoe.length))).map((c, i) => ({ rank: c.rank, suit: c.suit, id: i }));
}

/** The tag a card adds to the running count (`@/strategy` cardTag). */
export function cardTagOf(card: Card, system: DrillCountSystem): number {
  return cardTag(card, system);
}

/** The running count of the cards (`@/strategy` runningCount). */
export function runningCountOf(cards: readonly Card[], system: DrillCountSystem): number {
  return runningCount(cards, system);
}

/** Running count after each card. */
export function cumulativeCounts(cards: readonly Card[], system: DrillCountSystem): number[] {
  const out: number[] = [];
  let running = 0;
  for (const c of cards) {
    running += cardTag(c, system);
    out.push(running);
  }
  return out;
}

/**
 * True count when `cardsSeen` cards of a `decks`-deck shoe are gone: running ÷ max(decks remaining, 0.5), exactly
 * as `@/strategy` trueCount defines it.
 */
export function trueCountEstimate(running: number, cardsSeen: number, decks = 8): number {
  return trueCount(running, Math.max(0, decks * CARDS_PER_DECK - cardsSeen));
}

/** Decks left in a `decks`-deck shoe after `cardsSeen` cards (not floored; for the feedback arithmetic). */
export function decksLeft(cardsSeen: number, decks = 8): number {
  return Math.max(0, decks * CARDS_PER_DECK - cardsSeen) / CARDS_PER_DECK;
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
