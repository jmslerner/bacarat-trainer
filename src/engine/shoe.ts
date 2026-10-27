import type { Card, Rank, ShoeInfo, TableRules } from './types';
import { buildDecks, cardValue } from './cards';
import type { Rng } from './rng';

/** Burn procedure: the exposed card's value decides how many more cards are burned face down (A=1, 2–9 face, T/J/Q/K=10). */
export function burnCountForRank(rank: Rank): number {
  const value = cardValue(rank);
  return value === 0 ? 10 : value;
}

function shuffleInPlace(cards: Card[], rng: Rng): void {
  // Fisher–Yates, unbiased: each permutation is equally likely.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
}

function assignIds(cards: readonly Card[]): Card[] {
  const out: Card[] = new Array<Card>(cards.length);
  for (let i = 0; i < cards.length; i++) out[i] = { rank: cards[i].rank, suit: cards[i].suit, id: i };
  return out;
}

/**
 * A dealing shoe: shuffled cards, the cut card and the burn procedure, exactly as at the table.
 *
 * Card ids equal their position in the shuffled shoe (0 = first card out), so they are unique within the shoe.
 * The card at `cutCardIndex` sits right behind the cut card: drawing it (or any later card) sets `cutCardReached`.
 */
export class Shoe {
  readonly shoeNumber: number;
  readonly totalCards: number;
  readonly cutCardIndex: number;
  readonly exposedBurnCard: Card | null;
  readonly burnedCards: Card[] = [];
  /** Set as soon as the card behind the cut card has been drawn. */
  cutCardReached = false;

  private readonly cards: readonly Card[];
  private position = 0;

  /**
   * Builds, shuffles and cuts a fresh shoe, then runs the burn procedure when the rules ask for it.
   * `prearranged` (internal, used by `Shoe.fromCards`) skips the shuffle and deals the given cards in order.
   */
  constructor(rules: TableRules, rng: Rng, shoeNumber = 1, prearranged?: readonly Card[]) {
    this.shoeNumber = shoeNumber;
    if (prearranged) {
      this.cards = assignIds(prearranged);
    } else {
      const cards = buildDecks(rules.decks);
      shuffleInPlace(cards, rng);
      this.cards = assignIds(cards);
    }
    this.totalCards = this.cards.length;

    const fromEnd = Number.isFinite(rules.cutCardFromEnd) ? Math.max(0, Math.floor(rules.cutCardFromEnd)) : 14;
    this.cutCardIndex = Math.max(0, this.totalCards - fromEnd);

    let exposed: Card | null = null;
    if (rules.burnProcedure && this.totalCards > 0) {
      exposed = this.draw();
      const burn = burnCountForRank(exposed.rank);
      for (let i = 0; i < burn && this.position < this.totalCards; i++) this.burnedCards.push(this.draw());
    }
    this.exposedBurnCard = exposed;
  }

  /**
   * A shoe that deals exactly the given cards in order (no shuffle). Ids are reassigned 0..n-1.
   * The cut card and burn procedure still follow `rules`. For tests, lessons and rigged demonstrations.
   */
  static fromCards(cards: readonly Card[], rules: TableRules, shoeNumber = 1): Shoe {
    const noRng: Rng = {
      seed: 0,
      next: () => 0,
      nextInt: () => 0,
    };
    return new Shoe(rules, noRng, shoeNumber, cards);
  }

  /** Draws the next card. Throws a RangeError when the shoe is empty. */
  draw(): Card {
    const index = this.position;
    if (index >= this.totalCards) throw new RangeError('The shoe is empty');
    if (index >= this.cutCardIndex) this.cutCardReached = true;
    this.position = index + 1;
    return this.cards[index];
  }

  cardsRemaining(): number {
    return this.totalCards - this.position;
  }

  /** Cards out of the shoe so far, including the exposed burn card and the face-down burned cards. */
  cardsDealt(): number {
    return this.position;
  }

  info(handsDealt: number, lastHandNext: boolean): ShoeInfo {
    return {
      shoeNumber: this.shoeNumber,
      totalCards: this.totalCards,
      cardsRemaining: this.cardsRemaining(),
      cardsDealt: this.position,
      cutCardReached: this.cutCardReached,
      lastHandNext,
      exposedBurnCard: this.exposedBurnCard,
      burnedCount: this.burnedCards.length,
      handsDealt,
    };
  }
}
