/**
 * Side-bet card counts for the Coach panel.
 *
 * Mirrors the `@/strategy` contract (SPEC §5.3: `CountSystem`, `countStates`, `trueCount`) so the Coach can be
 * switched to `import { countStates, DRAGON7_COUNT, PANDA8_COUNT } from '@/strategy'` once that module's barrel
 * lands; the tag sets are the SPEC's Jacobson Dragon 7 count and the Panda 8 count derived in docs/COUNTING.md.
 */
import { cardValue } from '@/engine';
import type { Card } from '@/engine';

export interface CountState {
  running: number;
  /** running ÷ max(decks remaining, 0.5). */
  trueCount: number;
}

export interface CountSystem {
  id: 'dragon7' | 'panda8';
  name: string;
  description: string;
  /** Tag per card VALUE: index 0 = 10/J/Q/K, 1 = Ace, 2..9. */
  tags: readonly number[];
  /** Bet the side bet when the true count is at or above this. */
  threshold: number;
}

/** Jacobson's Dragon 7 count (SPEC §3): 4, 5, 6, 7 = −1; 8, 9 = +2; everything else 0. Bet at a true count ≥ 4. */
export const DRAGON7_COUNT: CountSystem = Object.freeze({
  id: 'dragon7',
  name: 'Dragon 7 count',
  description: '4, 5, 6, 7 count −1; 8, 9 count +2; everything else 0.',
  tags: Object.freeze([0, 0, 0, 0, -1, -1, -1, -1, 2, 2]),
  threshold: 4,
});

/** Panda 8 count derived from the effect-of-removal table (docs/COUNTING.md). Bet at a true count ≥ 8. */
export const PANDA8_COUNT: CountSystem = Object.freeze({
  id: 'panda8',
  name: 'Panda 8 count',
  description: '10s, Ace and 2 count +1; 3 and 8 count −2; 4, 5, 6, 7 count −1; 9 counts +2.',
  tags: Object.freeze([1, 1, 1, -2, -1, -1, -1, -1, -2, 2]),
  threshold: 8,
});

export const CARDS_PER_DECK = 52;

export function runningCount(cards: readonly Card[], system: CountSystem): number {
  let running = 0;
  for (let i = 0; i < cards.length; i++) running += system.tags[cardValue(cards[i].rank)];
  return running;
}

export function decksRemaining(cardsRemaining: number): number {
  return Math.max(0, cardsRemaining) / CARDS_PER_DECK;
}

/** running ÷ max(decks remaining, 0.5): the half-deck floor keeps the end of the shoe from exploding the count. */
export function trueCount(running: number, cardsRemaining: number): number {
  return running / Math.max(decksRemaining(cardsRemaining), 0.5);
}

export function countState(seenCards: readonly Card[], cardsRemaining: number, system: CountSystem): CountState {
  const running = runningCount(seenCards, system);
  return { running, trueCount: trueCount(running, cardsRemaining) };
}

/** Both side-bet counts from every face-up card seen in the shoe (exposed burn card first). */
export function countStates(seenCards: readonly Card[], cardsRemaining: number): { dragon7: CountState; panda8: CountState } {
  return {
    dragon7: countState(seenCards, cardsRemaining, DRAGON7_COUNT),
    panda8: countState(seenCards, cardsRemaining, PANDA8_COUNT),
  };
}
