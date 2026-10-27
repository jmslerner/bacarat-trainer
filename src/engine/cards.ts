import type { Card, Rank, Suit } from './types';

/** Ranks in deck order. 'T' is the ten (displayed as "10"). */
export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
/** Suits in deck order: Spades, Hearts, Diamonds, Clubs. */
export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

const VALUE_BY_RANK: Readonly<Record<Rank, number>> = Object.freeze({
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 0, J: 0, Q: 0, K: 0,
});

export const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = Object.freeze({ S: '♠', H: '♥', D: '♦', C: '♣' });
export const SUIT_NAMES: Readonly<Record<Suit, string>> = Object.freeze({ S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' });

/** Baccarat value of a rank: Ace = 1, 2–9 face value, 10/J/Q/K = 0. */
export function cardValue(rank: Rank): number {
  return VALUE_BY_RANK[rank];
}

/** Baccarat total of a hand: sum of card values modulo 10. */
export function handTotal(cards: readonly Card[]): number {
  let total = 0;
  for (let i = 0; i < cards.length; i++) total += VALUE_BY_RANK[cards[i].rank];
  return total % 10;
}

/** "10" for the ten, otherwise the rank letter/digit. */
export function rankLabel(rank: Rank): string {
  return rank === 'T' ? '10' : rank;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

/** Hearts and Diamonds are printed red. */
export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** e.g. "A♠", "10♥", "K♣". */
export function cardLabel(card: Card): string {
  return rankLabel(card.rank) + SUIT_SYMBOLS[card.suit];
}

/** True when `rank` is one of the thirteen ranks (useful for data from storage or drills). */
export function isRank(value: unknown): value is Rank {
  return typeof value === 'string' && (RANKS as readonly string[]).includes(value);
}

/**
 * Builds `decks` unshuffled 52-card decks (deck by deck, suit by suit, Ace to King).
 * The ids are the build positions; `Shoe` reassigns ids after shuffling (id = position in the shoe).
 */
export function buildDecks(decks: number): Card[] {
  if (!Number.isInteger(decks) || decks < 1) {
    throw new RangeError(`buildDecks: decks must be a positive integer (got ${decks})`);
  }
  const cards: Card[] = new Array<Card>(decks * 52);
  let id = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards[id] = { rank, suit, id };
        id++;
      }
    }
  }
  return cards;
}
