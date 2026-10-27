/**
 * SHARED CONTRACT for the Baccarat Trainer.
 * Every module (engine, roads, strategy, ui) codes against these types.
 * Do not change a shape here without updating docs/SPEC.md.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K';

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
  /** Unique within a shoe (0..totalCards-1 in shuffled order). Stable React key. */
  readonly id: number;
}

export type Side = 'player' | 'banker';
export type Outcome = 'player' | 'banker' | 'tie';

export type BetType = 'player' | 'banker' | 'tie' | 'dragon7' | 'panda8' | 'playerPair' | 'bankerPair';
export const BET_TYPES: readonly BetType[] = ['player', 'banker', 'tie', 'dragon7', 'panda8', 'playerPair', 'bankerPair'];
export const MAIN_BETS: readonly BetType[] = ['player', 'banker', 'tie'];
export const SIDE_BETS: readonly BetType[] = ['dragon7', 'panda8', 'playerPair', 'bankerPair'];

/**
 * 'ez'         EZ Baccarat: Banker pays 1:1, no commission, but a Banker win with a THREE-card total of 7 is a push (the Dragon 7).
 * 'commission' Classic: Banker pays 1:1 minus 5% commission.
 * 'super6'     Super 6 / Punto 2000: Banker pays 1:1 except a Banker win with a total of 6 pays 1:2 (half).
 */
export type BankerRule = 'ez' | 'commission' | 'super6';

export interface BetLimits {
  min: number;
  max: number;
}

export interface TableRules {
  decks: 6 | 8;
  bankerRule: BankerRule;
  /** Commission on Banker wins when bankerRule === 'commission' (0.05). Ignored otherwise. */
  commissionRate: number;
  /** Tie pays N to 1 (8 standard, 9 at some tables). */
  tiePays: number;
  /** Dragon 7 pays N to 1 (40). */
  dragon7Pays: number;
  /** Panda 8 pays N to 1 (25). */
  panda8Pays: number;
  /** Player Pair / Banker Pair pay N to 1 (11). */
  pairPays: number;
  sideBets: { dragon7: boolean; panda8: boolean; pairs: boolean };
  limits: { main: BetLimits; tie: BetLimits; side: BetLimits };
  /** Cut card is inserted this many cards from the end of the shoe (14 typical). */
  cutCardFromEnd: number;
  /** Casino burn procedure at the start of a shoe (expose first card, burn that many). */
  burnProcedure: boolean;
  /** Chip denominations offered in the tray, ascending. */
  chipDenominations: number[];
}

/** One animation/narration step of a hand, in order. Messages are dealer calls, ready to display. */
export type DealStep =
  | { type: 'deal'; to: Side; card: Card; index: 0 | 1 | 2; message: string }
  | { type: 'show'; playerTotal: number; bankerTotal: number; message: string }
  | { type: 'natural'; side: Side | 'both'; message: string }
  | { type: 'stand'; side: Side; message: string }
  | { type: 'draw'; side: Side; message: string }
  | { type: 'result'; outcome: Outcome; playerTotal: number; bankerTotal: number; message: string }
  | { type: 'bonus'; kind: 'dragon7' | 'panda8' | 'playerPair' | 'bankerPair'; message: string }
  | { type: 'cutCard'; message: string };

export interface HandResult {
  /** 1-based within the shoe. */
  handNumber: number;
  shoeNumber: number;
  playerCards: Card[];
  bankerCards: Card[];
  playerTotal: number;
  bankerTotal: number;
  outcome: Outcome;
  playerNatural: boolean;
  bankerNatural: boolean;
  /** Banker WON with a three-card total of 7. */
  dragon7: boolean;
  /** Player WON with a three-card total of 8. */
  panda8: boolean;
  /** First two Player cards share a rank. */
  playerPair: boolean;
  /** First two Banker cards share a rank. */
  bankerPair: boolean;
  /** Banker won with a total of 6 (Super 6 half-pay). */
  bankerWinOn6: boolean;
  /** The cut card came out during this hand (one more hand is dealt, then a new shoe). */
  cutCardDrawn: boolean;
  /** Ordered steps for animation and dealer narration. Empty when dealt with withSteps=false. */
  steps: DealStep[];
}

export type Bets = Partial<Record<BetType, number>>;

export type BetResult = 'win' | 'lose' | 'push';

export interface BetSettlement {
  bet: BetType;
  amount: number;
  result: BetResult;
  /** Net change to bankroll from this bet: +winnings (after commission), -amount on a loss, 0 on a push. */
  net: number;
  /** Commission deducted from this bet's winnings (classic Banker only), else 0. */
  commission: number;
}

export interface HandSettlement {
  settlements: BetSettlement[];
  /** Sum of settlement nets. */
  net: number;
  /** Total commission deducted this hand. */
  commission: number;
  totalWagered: number;
}

export interface ShoeInfo {
  shoeNumber: number;
  totalCards: number;
  cardsRemaining: number;
  /** Cards drawn so far, including the exposed burn card and burned cards. */
  cardsDealt: number;
  cutCardReached: boolean;
  /** True when the NEXT hand is the final hand of this shoe (cut card already came out). */
  lastHandNext: boolean;
  /** First card turned face up at the start of the shoe (burn procedure), null if burnProcedure is off. */
  exposedBurnCard: Card | null;
  /** Number of cards burned face down after the exposed card. */
  burnedCount: number;
  /** Hands completed in this shoe. */
  handsDealt: number;
}

export interface BetTypeStats {
  count: number;
  wagered: number;
  net: number;
  wins: number;
  losses: number;
  pushes: number;
}

export interface StreakInfo {
  outcome: Outcome | null;
  length: number;
}

export interface SessionStats {
  handsPlayed: number;
  handsBet: number;
  shoesPlayed: number;
  playerWins: number;
  bankerWins: number;
  ties: number;
  dragon7s: number;
  panda8s: number;
  playerPairs: number;
  bankerPairs: number;
  naturals: number;
  totalWagered: number;
  net: number;
  commissionPaid: number;
  startingBankroll: number;
  peakBankroll: number;
  lowBankroll: number;
  maxDrawdown: number;
  byBet: Record<BetType, BetTypeStats>;
  currentStreak: StreakInfo;
  longestPlayerStreak: number;
  longestBankerStreak: number;
}

export interface SessionState {
  rules: TableRules;
  bankroll: number;
  /** Bets currently on the layout (not yet dealt). */
  bets: Bets;
  /** Bets from the last dealt hand (for Rebet). */
  lastBets: Bets;
  shoe: ShoeInfo;
  /** Results of hands in the CURRENT shoe, in order. */
  shoeHistory: HandResult[];
  /** Hands dealt this session (all shoes). */
  totalHands: number;
  lastHand: { result: HandResult; settlement: HandSettlement } | null;
  /** All face-up cards seen in the current shoe, in order (exposed burn card first), for card counting. */
  seenCards: Card[];
  stats: SessionStats;
  seed: number;
}
