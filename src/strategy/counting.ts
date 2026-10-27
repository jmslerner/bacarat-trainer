import { cardValue } from '@/engine';
import type { Card } from '@/engine';
import type { CountState, CountSystem } from './types';

export const CARDS_PER_DECK = 52;

/**
 * Jacobson's Dragon 7 count (SPEC §3): 4, 5, 6, 7 = −1; 8, 9 = +2; Ace, 2, 3 and the zero-value cards = 0.
 * Balanced over any number of decks (4 × −1 + 2 × +2 = 0 per suit). Bet the Dragon 7 at a true count of 4 or more.
 */
export const DRAGON7_COUNT: CountSystem = Object.freeze({
  id: 'dragon7',
  name: 'Dragon 7 count',
  description: 'Jacobson: 4, 5, 6, 7 count −1; 8, 9 count +2; everything else 0. Bet the Dragon 7 at a true count of +4 or more.',
  tags: Object.freeze([0, 0, 0, 0, -1, -1, -1, -1, 2, 2]) as number[],
  threshold: 4,
});

/**
 * Panda 8 count derived in docs/COUNTING.md: of every balanced tag set with tags in −2..+2, the one with the best
 * betting correlation (0.959) to the 8-deck effect-of-removal table, then validated over 500,000 simulated shoes
 * (see COUNT_EV_TABLE). 10/J/Q/K, Ace, 2 = +1; 3, 4, 5 = −2; 6 = 0; 7, 8 = −1; 9 = +2.
 * Bet the Panda 8 at a true count of 8 or more (about 6% of hands, +4.9% per bet).
 */
export const PANDA8_COUNT: CountSystem = Object.freeze({
  id: 'panda8',
  name: 'Panda 8 count',
  description: '10/J/Q/K, Ace and 2 count +1; 3, 4 and 5 count −2; 7 and 8 count −1; 9 counts +2; 6 counts 0. Bet the Panda 8 at a true count of +8 or more.',
  tags: Object.freeze([1, 1, 1, -2, -2, -2, 0, -1, -1, 2]) as number[],
  threshold: 8,
});

export const COUNT_SYSTEMS: Readonly<Record<'dragon7' | 'panda8', CountSystem>> = Object.freeze({
  dragon7: DRAGON7_COUNT,
  panda8: PANDA8_COUNT,
});

/** The tag a card adds to the running count. */
export function cardTag(card: Card, system: CountSystem): number {
  return system.tags[cardValue(card.rank)];
}

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

/** True when the count says the side bet is worth placing (true count at or above the system's threshold). */
export function isCountFavourable(state: CountState, system: CountSystem): boolean {
  return state.trueCount >= system.threshold;
}
