import type { Card, DealStep, HandResult, Outcome, Rank, Side, Suit, TableRules } from './types';
import { cardValue, handTotal, isRank, RANKS, SUITS } from './cards';
import { bankerDraws, DEFAULT_RULES, playerDraws } from './rules';
import type { Shoe } from './shoe';

export interface DealOptions {
  /** Build the animation/narration steps (default true). Pass false for bulk simulation. */
  withSteps?: boolean;
}

/** Anything that can hand out cards in casino order. `Shoe` satisfies this; `draw` may ignore the side. */
interface CardSource {
  readonly shoeNumber: number;
  cutCardReached: boolean;
  draw(side: Side): Card;
}

const MSG_CARD_TO_PLAYER = 'Card to Player';
const MSG_CARD_TO_BANKER = 'Card to Banker';
export const MSG_CUT_CARD = 'Cut card — one more hand, then a new shoe';

function naturalStep(playerTotal: number, bankerTotal: number): DealStep {
  const p = playerTotal >= 8;
  const b = bankerTotal >= 8;
  if (p && b) {
    return { type: 'natural', side: 'both', message: `Natural ${playerTotal} — Player, Natural ${bankerTotal} — Banker` };
  }
  return p
    ? { type: 'natural', side: 'player', message: `Natural ${playerTotal} — Player` }
    : { type: 'natural', side: 'banker', message: `Natural ${bankerTotal} — Banker` };
}

function resultMessage(outcome: Outcome, playerTotal: number, bankerTotal: number): string {
  if (outcome === 'banker') return `Banker wins, ${bankerTotal} over ${playerTotal}`;
  if (outcome === 'player') return `Player wins, ${playerTotal} over ${bankerTotal}`;
  return `Tie, ${playerTotal} and ${bankerTotal}`;
}

/**
 * One code path for play and simulation. `steps` is null in the fast path (no narration, minimal allocation):
 * the result object and the two card arrays are the only allocations per hand.
 */
function dealCore(source: CardSource, rules: TableRules, handNumber: number, steps: DealStep[] | null): HandResult {
  const cutBefore = source.cutCardReached;

  // Casino dealing order: Player, Banker, Player, Banker.
  const p0 = source.draw('player');
  if (steps !== null) steps.push({ type: 'deal', to: 'player', card: p0, index: 0, message: MSG_CARD_TO_PLAYER });
  const b0 = source.draw('banker');
  if (steps !== null) steps.push({ type: 'deal', to: 'banker', card: b0, index: 0, message: MSG_CARD_TO_BANKER });
  const p1 = source.draw('player');
  if (steps !== null) steps.push({ type: 'deal', to: 'player', card: p1, index: 1, message: MSG_CARD_TO_PLAYER });
  const b1 = source.draw('banker');
  if (steps !== null) steps.push({ type: 'deal', to: 'banker', card: b1, index: 1, message: MSG_CARD_TO_BANKER });

  let playerTotal = (cardValue(p0.rank) + cardValue(p1.rank)) % 10;
  let bankerTotal = (cardValue(b0.rank) + cardValue(b1.rank)) % 10;
  const playerPair = p0.rank === p1.rank;
  const bankerPair = b0.rank === b1.rank;

  if (steps !== null) {
    if (playerPair && rules.sideBets.pairs) steps.push({ type: 'bonus', kind: 'playerPair', message: 'Player Pair' });
    if (bankerPair && rules.sideBets.pairs) steps.push({ type: 'bonus', kind: 'bankerPair', message: 'Banker Pair' });
    steps.push({ type: 'show', playerTotal, bankerTotal, message: `Player shows ${playerTotal}, Banker shows ${bankerTotal}` });
  }

  const playerNatural = playerTotal >= 8;
  const bankerNatural = bankerTotal >= 8;
  let p2: Card | null = null;
  let b2: Card | null = null;

  if (playerNatural || bankerNatural) {
    if (steps !== null) steps.push(naturalStep(playerTotal, bankerTotal));
  } else {
    let playerThird: number | null = null;
    if (playerDraws(playerTotal)) {
      if (steps !== null) steps.push({ type: 'draw', side: 'player', message: 'Player draws' });
      p2 = source.draw('player');
      playerThird = cardValue(p2.rank);
      playerTotal = (playerTotal + playerThird) % 10;
      if (steps !== null) steps.push({ type: 'deal', to: 'player', card: p2, index: 2, message: MSG_CARD_TO_PLAYER });
    } else if (steps !== null) {
      steps.push({ type: 'stand', side: 'player', message: 'Player stands' });
    }

    if (bankerDraws(bankerTotal, playerThird)) {
      if (steps !== null) steps.push({ type: 'draw', side: 'banker', message: 'Banker draws' });
      b2 = source.draw('banker');
      bankerTotal = (bankerTotal + cardValue(b2.rank)) % 10;
      if (steps !== null) steps.push({ type: 'deal', to: 'banker', card: b2, index: 2, message: MSG_CARD_TO_BANKER });
    } else if (steps !== null) {
      steps.push({ type: 'stand', side: 'banker', message: 'Banker stands' });
    }
  }

  const outcome: Outcome = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
  const dragon7 = outcome === 'banker' && b2 !== null && bankerTotal === 7;
  const panda8 = outcome === 'player' && p2 !== null && playerTotal === 8;
  const cutCardDrawn = !cutBefore && source.cutCardReached;

  if (steps !== null) {
    steps.push({ type: 'result', outcome, playerTotal, bankerTotal, message: resultMessage(outcome, playerTotal, bankerTotal) });
    // The dealer calls the Dragon 7 whenever it matters: it pushes the EZ Banker bet or pays the side bet.
    if (dragon7 && (rules.bankerRule === 'ez' || rules.sideBets.dragon7)) steps.push({ type: 'bonus', kind: 'dragon7', message: 'Dragon 7!' });
    if (panda8 && rules.sideBets.panda8) steps.push({ type: 'bonus', kind: 'panda8', message: 'Panda 8!' });
    if (cutCardDrawn) steps.push({ type: 'cutCard', message: MSG_CUT_CARD });
  }

  return {
    handNumber,
    shoeNumber: source.shoeNumber,
    playerCards: p2 === null ? [p0, p1] : [p0, p1, p2],
    bankerCards: b2 === null ? [b0, b1] : [b0, b1, b2],
    playerTotal,
    bankerTotal,
    outcome,
    playerNatural,
    bankerNatural,
    dragon7,
    panda8,
    playerPair,
    bankerPair,
    bankerWinOn6: outcome === 'banker' && bankerTotal === 6,
    cutCardDrawn,
    steps: steps === null ? [] : steps,
  };
}

/**
 * Deals one hand from the shoe in casino order, applying the third-card rules of SPEC §2 exactly.
 * With `withSteps: false` no narration is built and the hand allocates only the result and its two card arrays.
 */
export function dealHand(shoe: Shoe, rules: TableRules, handNumber: number, opts?: DealOptions): HandResult {
  const withSteps = opts === undefined || opts.withSteps !== false;
  return dealCore(shoe, rules, handNumber, withSteps ? [] : null);
}

/**
 * Evaluates already-dealt cards (2 or 3 per side) without checking that the drawing rules were followed.
 * A natural is a two-card 8 or 9; Dragon 7 / Panda 8 need the WIN with three cards.
 */
export function evaluateHand(
  playerCards: readonly Card[],
  bankerCards: readonly Card[],
): Pick<HandResult, 'playerTotal' | 'bankerTotal' | 'outcome' | 'playerNatural' | 'bankerNatural' | 'dragon7' | 'panda8' | 'playerPair' | 'bankerPair' | 'bankerWinOn6'> {
  const playerTotal = handTotal(playerCards);
  const bankerTotal = handTotal(bankerCards);
  const outcome: Outcome = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
  return {
    playerTotal,
    bankerTotal,
    outcome,
    playerNatural: playerCards.length === 2 && playerTotal >= 8,
    bankerNatural: bankerCards.length === 2 && bankerTotal >= 8,
    dragon7: outcome === 'banker' && bankerCards.length === 3 && bankerTotal === 7,
    panda8: outcome === 'player' && playerCards.length === 3 && playerTotal === 8,
    playerPair: playerCards.length >= 2 && playerCards[0].rank === playerCards[1].rank,
    bankerPair: bankerCards.length >= 2 && bankerCards[0].rank === bankerCards[1].rank,
    bankerWinOn6: outcome === 'banker' && bankerTotal === 6,
  };
}

/**
 * A card described by its baccarat value (0–9) or its exact rank.
 * Values 2–9 and 1 (Ace) map to that rank; 0 cycles through T, J, Q, K so that two zeros never form an
 * accidental pair. Pass ranks (e.g. 'T', 'T') when a specific pair is wanted.
 */
export type CardSpec = number | Rank;

const ZERO_RANKS: readonly Rank[] = ['T', 'J', 'Q', 'K'];

/** Builds synthetic cards from specs, with cycling suits and ids starting at `startId`. */
export function cardsFromValues(specs: readonly CardSpec[], startId = 0): Card[] {
  let zeros = 0;
  return specs.map((spec, i) => {
    const suit: Suit = SUITS[i % SUITS.length];
    return { rank: rankFromSpec(spec, () => ZERO_RANKS[zeros++ % ZERO_RANKS.length]), suit, id: startId + i };
  });
}

function rankFromSpec(spec: CardSpec, nextZero: () => Rank): Rank {
  if (typeof spec === 'string') {
    if (!isRank(spec)) throw new RangeError(`Unknown rank "${spec}"`);
    return spec;
  }
  if (!Number.isInteger(spec) || spec < 0 || spec > 9) throw new RangeError(`Card value must be an integer 0–9 (got ${spec})`);
  if (spec === 0) return nextZero();
  return RANKS[spec - 1];
}

class FixedSource implements CardSource {
  readonly shoeNumber = 0;
  cutCardReached = false;
  private playerIndex = 0;
  private bankerIndex = 0;
  private zeros = 0;
  private nextId = 0;

  constructor(private readonly player: readonly CardSpec[], private readonly banker: readonly CardSpec[]) {}

  draw(side: Side): Card {
    const specs = side === 'player' ? this.player : this.banker;
    const index = side === 'player' ? this.playerIndex++ : this.bankerIndex++;
    if (index >= specs.length) {
      throw new RangeError(`dealFromValues: ${side === 'player' ? 'Player' : 'Banker'} needs card ${index + 1} but only ${specs.length} were supplied`);
    }
    const id = this.nextId++;
    const rank = rankFromSpec(specs[index], () => ZERO_RANKS[this.zeros++ % ZERO_RANKS.length]);
    return { rank, suit: SUITS[id % SUITS.length], id };
  }
}

/**
 * Deals a hand from hand-made cards: the first two specs of each side are the initial cards and the third is
 * drawn only when the rules call for it (extra specs are ignored; a missing needed third card throws).
 * Produces a complete HandResult with steps, for drills and lessons.
 */
export function dealFromValues(
  playerValues: readonly CardSpec[],
  bankerValues: readonly CardSpec[],
  rules: TableRules = DEFAULT_RULES,
  handNumber = 1,
): HandResult {
  if (playerValues.length < 2 || bankerValues.length < 2) {
    throw new RangeError('dealFromValues: each side needs at least two cards');
  }
  return dealCore(new FixedSource(playerValues, bankerValues), rules, handNumber, []);
}
