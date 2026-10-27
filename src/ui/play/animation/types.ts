/**
 * Display model of the table while a hand is animated.
 *
 * The engine settles a hand synchronously; the table holds the previous session snapshot and plays the hand back
 * step by step from a timeline of `Frame`s (see timeline.ts). Everything here is plain data so the timeline can be
 * unit-tested without React.
 */
import type { BetResult, BetType, Card, Outcome, Side } from '@/engine';
import type { SoundName } from '@/ui/shell';

export type Phase = 'idle' | 'dealing' | 'settling' | 'settled' | 'shuffling';

export interface HandDisplay {
  playerCards: Card[];
  bankerCards: Card[];
  /** null until the dealer calls the totals ("Player shows 5, Banker shows 3"). */
  playerTotal: number | null;
  bankerTotal: number | null;
  /** The dealer's current call. */
  message: string;
  /** Beginner tip for the current call (null when tips are off or nothing applies). */
  tip: string | null;
  natural: Side | 'both' | null;
  /** Set once the result has been called. */
  outcome: Outcome | null;
  dragon7: boolean;
  panda8: boolean;
  playerPair: boolean;
  bankerPair: boolean;
  /** The cut card came out during this hand. */
  cutCard: boolean;
  /** Index of the step being shown (−1 before the first). */
  step: number;
}

export interface SpotDisplay {
  /** Chips on the spot, bottom first. */
  chips: readonly number[];
  amount: number;
  /** null until settled. */
  result: BetResult | null;
  /** Net change from this spot (+winnings, −amount, 0 on a push). */
  net: number;
  /** The losing chips have been collected by the dealer. */
  swept: boolean;
}

export type LayoutDisplay = Partial<Record<BetType, SpotDisplay>>;

export interface ShuffleDisplay {
  stage: 'shuffling' | 'cut' | 'burn';
  message: string;
  /** The exposed burn card (burn stage). */
  card: Card | null;
  burned: number;
}

export type FrameEvent = 'settled' | 'done';

/** One keyframe of the table: whatever it carries is applied at `at` milliseconds from the start. */
export interface Frame {
  at: number;
  phase?: Phase;
  hand?: HandDisplay;
  layout?: LayoutDisplay | null;
  bankroll?: number;
  shuffle?: ShuffleDisplay | null;
  sound?: SoundName;
  /** Play the sound even when the animation is skipped or instant. */
  keySound?: boolean;
  /** Text for the settlement status region ("You won $25"). */
  announce?: string;
  event?: FrameEvent;
}

export function emptyHand(message = 'Place your bets'): HandDisplay {
  return {
    playerCards: [],
    bankerCards: [],
    playerTotal: null,
    bankerTotal: null,
    message,
    tip: null,
    natural: null,
    outcome: null,
    dragon7: false,
    panda8: false,
    playerPair: false,
    bankerPair: false,
    cutCard: false,
    step: -1,
  };
}
