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

/** The two side bets the table celebrates. */
export type BonusKind = 'dragon7' | 'panda8';

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
  /**
   * The sides whose third card the dealer squeezes this hand (timeline.ts `squeezeSides`): it lands face down, waits
   * while the drum rolls and turns when the total is called — hit or miss. Stays set for the rest of the hand so the
   * card finishes its turn; a fast-forward clears it and the card snaps face up. null = ordinary flips.
   */
  reveal: Side | 'both' | null;
  /**
   * The side whose squeezed third card is lying face down right now: from the moment it lands until the dealer calls
   * the total. Until then nothing may name it — not its own label, the hand's label, the totals or the card counts.
   */
  faceDown: Side | null;
  /** The current call is the hit itself ("Dragon 7!" / "Panda 8!"): the dealer bar shows it large. */
  hit: BonusKind | null;
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

/** The Dragon 7 / Panda 8 moment: what the celebration overlay shows and how long it holds. */
export interface Celebration {
  /** Unique per hand and kind: effects (particles, sound, pulses) run once per id, re-renders never re-trigger them. */
  id: string;
  kind: BonusKind;
  /** The side that won with the three-card total. */
  side: Side;
  /** Odds paid (40 for "40 to 1"). */
  pays: number;
  /** Net won on the Dragon 7 / Panda 8 bet (0 without one). */
  won: number;
  /** The table offers the side bet (an EZ table can have the Dragon 7 bet switched off and still call the push). */
  offered: boolean;
  /** The player had the bet on the layout. */
  hadBet: boolean;
  /** An EZ Banker bet pushes on the Dragon 7. */
  bankerPush: boolean;
  /** How long the moment is held before the banner fades (the settlement follows at animated speeds). */
  holdMs: number;
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
  /** Show the Dragon 7 / Panda 8 celebration (null clears it; undefined leaves it alone). */
  celebrate?: Celebration | null;
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
    reveal: null,
    faceDown: null,
    hit: null,
  };
}
