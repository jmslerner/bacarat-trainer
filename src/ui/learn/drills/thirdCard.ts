/**
 * Third-card drill logic (pure). Generates a random LEGAL two-card situation — no natural on either side, the
 * Player's third card drawn or not — and asks whether Banker (or, sometimes, Player) draws. The engine's
 * `playerDraws` / `bankerDraws` are the oracle.
 */
import { RANKS, SUITS, bankerDraws, cardLabel, cardValue, playerDraws } from '@/engine';
import type { Card, Rank, Rng } from '@/engine';
import { weightedIndex } from './seeds';

export type ThirdCardAsk = 'player' | 'banker';

export interface ThirdCardQuestion {
  ask: ThirdCardAsk;
  /** Two cards, or three when the Player drew (only in Banker questions). */
  playerCards: Card[];
  bankerCards: Card[];
  /** Two-card totals. */
  playerTotal: number;
  bankerTotal: number;
  /** The Player's third card when one was drawn, else null. */
  playerThird: Card | null;
  /** Does the asked side draw a third card? */
  answer: boolean;
}

export interface BankerTableRow {
  total: number;
  /** Player third-card values on which Banker draws. */
  draws: readonly number[];
  /** Player third-card values on which Banker stands. */
  stands: readonly number[];
}

const ALL_VALUES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The Banker table of SPEC §2, used for the drill's rule reveal. */
export const BANKER_TABLE: readonly BankerTableRow[] = [0, 1, 2, 3, 4, 5, 6, 7].map((total) => {
  const draws = ALL_VALUES.filter((p3) => bankerDraws(total, p3));
  const stands = ALL_VALUES.filter((p3) => !bankerDraws(total, p3));
  return { total, draws, stands };
});

export const PLAYER_RULE = Object.freeze({ draws: [0, 1, 2, 3, 4, 5] as readonly number[], stands: [6, 7] as readonly number[] });

/** Ranks that carry a given baccarat value (0 → the four ten-value ranks). */
export function ranksWithValue(value: number): Rank[] {
  return RANKS.filter((r) => cardValue(r) === value);
}

function randomCard(rng: Rng, rank: Rank, id: number): Card {
  return { rank, suit: SUITS[rng.nextInt(SUITS.length)], id };
}

/** Two random cards whose baccarat total is `total` (0–9). */
export function twoCardsWithTotal(rng: Rng, total: number, startId = 0): Card[] {
  const first = RANKS[rng.nextInt(RANKS.length)];
  const need = (total - cardValue(first) + 10) % 10;
  const candidates = ranksWithValue(need);
  const second = candidates[rng.nextInt(candidates.length)];
  return [randomCard(rng, first, startId), randomCard(rng, second, startId + 1)];
}

/** Formats values for a rule sentence: "0, 1, 2, 3 or 9". */
export function listValues(values: readonly number[]): string {
  if (values.length === 0) return 'nothing';
  if (values.length === 1) return String(values[0]);
  return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;
}

/**
 * A random legal situation. Banker questions (70%) lean on the tricky rows (Banker 3–6 with a Player third
 * card) and balance "draw" against "stand" cases so the drill does not reward always answering "draws".
 */
export function generateThirdCardQuestion(rng: Rng): ThirdCardQuestion {
  const ask: ThirdCardAsk = rng.next() < 0.3 ? 'player' : 'banker';

  if (ask === 'player') {
    const playerTotal = weightedIndex([1, 1, 1, 1, 2, 3, 3, 2], () => rng.next()); // 0..7, boundary emphasised
    const bankerTotal = rng.nextInt(8);
    const playerCards = twoCardsWithTotal(rng, playerTotal, 0);
    const bankerCards = twoCardsWithTotal(rng, bankerTotal, 2);
    return { ask, playerCards, bankerCards, playerTotal, bankerTotal, playerThird: null, answer: playerDraws(playerTotal) };
  }

  const bankerTotal = weightedIndex([1, 1, 1, 3, 3, 3, 3, 1.5], () => rng.next()); // 0..7
  const tricky = bankerTotal >= 3 && bankerTotal <= 6;
  const playerDrew = rng.next() < (tricky ? 0.8 : 0.5);

  if (!playerDrew) {
    const playerTotal = 6 + rng.nextInt(2);
    const playerCards = twoCardsWithTotal(rng, playerTotal, 0);
    const bankerCards = twoCardsWithTotal(rng, bankerTotal, 2);
    return { ask, playerCards, bankerCards, playerTotal, bankerTotal, playerThird: null, answer: bankerDraws(bankerTotal, null) };
  }

  const playerTotal = rng.nextInt(6); // 0..5: Player draws
  const playerCards = twoCardsWithTotal(rng, playerTotal, 0);
  const bankerCards = twoCardsWithTotal(rng, bankerTotal, 2);
  let thirdRank: Rank;
  if (tricky) {
    const row = BANKER_TABLE[bankerTotal];
    const pool = rng.next() < 0.5 ? row.draws : row.stands;
    const value = pool[rng.nextInt(pool.length)];
    const ranks = ranksWithValue(value);
    thirdRank = ranks[rng.nextInt(ranks.length)];
  } else {
    thirdRank = RANKS[rng.nextInt(RANKS.length)];
  }
  const playerThird = randomCard(rng, thirdRank, 4);
  playerCards.push(playerThird);
  return {
    ask,
    playerCards,
    bankerCards,
    playerTotal,
    bankerTotal,
    playerThird,
    answer: bankerDraws(bankerTotal, cardValue(playerThird.rank)),
  };
}

export interface ThirdCardExplanation {
  /** "Banker draws" / "Player stands" … */
  headline: string;
  /** The rule applied to this situation. */
  reason: string;
  /** A memorable hint. */
  tip: string;
  /** Row of the Banker table to highlight, or null for Player questions. */
  row: number | null;
  /** Player third-card value to highlight in that row, or null when the Player stood / Player question. */
  p3: number | null;
}

const ROW_TIPS: Readonly<Record<number, string>> = {
  0: 'Banker 0, 1 and 2 always draw.',
  1: 'Banker 0, 1 and 2 always draw.',
  2: 'Banker 0, 1 and 2 always draw.',
  3: 'Banker 3 draws against everything except an 8.',
  4: 'Banker 4 draws against 2 through 7.',
  5: 'Banker 5 draws against 4 through 7.',
  6: 'Banker 6 draws only against a 6 or a 7.',
  7: 'Banker 7 always stands.',
};

export function explainThirdCard(q: ThirdCardQuestion): ThirdCardExplanation {
  if (q.ask === 'player') {
    const draws = q.answer;
    return {
      headline: draws ? 'Player draws' : 'Player stands',
      reason: `Player has ${q.playerTotal}. Player draws a third card on 0–5 and stands on 6–7, so Player ${draws ? 'draws' : 'stands'}.`,
      tip: 'Player acts first and never looks at Banker’s hand. Only a natural 8 or 9 on either side stops the hand before this rule.',
      row: null,
      p3: null,
    };
  }

  const draws = q.answer;
  const headline = draws ? 'Banker draws' : 'Banker stands';

  if (q.playerThird === null) {
    return {
      headline,
      reason: `Player stood on ${q.playerTotal}. When Player stands, Banker uses the same rule as Player: draws on 0–5, stands on 6–7. Banker has ${q.bankerTotal}, so Banker ${draws ? 'draws' : 'stands'}.`,
      tip: 'No Player third card → the table is not needed: Banker simply draws on 0–5.',
      row: q.bankerTotal,
      p3: null,
    };
  }

  const p3 = cardValue(q.playerThird.rank);
  const label = cardLabel(q.playerThird);
  const row = BANKER_TABLE[q.bankerTotal];
  let reason: string;
  if (q.bankerTotal <= 2) {
    reason = `Player drew ${label} (value ${p3}). Banker has ${q.bankerTotal}: with 0, 1 or 2 Banker always draws, whatever the Player’s third card is.`;
  } else if (q.bankerTotal === 7) {
    reason = `Player drew ${label} (value ${p3}). Banker has 7 and always stands — the Player’s third card does not matter.`;
  } else {
    reason = `Player drew ${label} (value ${p3}). Banker has ${q.bankerTotal}: Banker draws when the Player’s third card is ${listValues(row.draws)} and stands on ${listValues(row.stands)}. ${p3 === 8 ? 'An' : 'A'} ${p3} means Banker ${draws ? 'draws' : 'stands'}.`;
  }
  return { headline, reason, tip: ROW_TIPS[q.bankerTotal], row: q.bankerTotal, p3 };
}
