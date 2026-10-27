import { BET_TYPES } from './types';
import type { BetType, BetTypeStats, Bets, Card, HandResult, HandSettlement, SessionState, SessionStats, ShoeInfo, StreakInfo, TableRules } from './types';
import { createRng, randomSeed, type Rng } from './rng';
import { cloneRules, DEFAULT_RULES, validateRules } from './rules';
import { Shoe } from './shoe';
import { dealHand } from './deal';
import { formatMoney, roundCents, settleBets, totalOnLayout, validateBet, validateLayout } from './settle';

export interface SessionOptions {
  rules?: TableRules;
  bankroll?: number;
  seed?: number;
}

export interface PlaceBetResult {
  ok: boolean;
  reason?: string;
}

export interface DealOutcome {
  result: HandResult;
  settlement: HandSettlement;
  /** A new shoe was started by this deal: after the final hand that follows the cut card, or when the shoe ran out. */
  newShoeStarted: boolean;
}

/** One chip placed on a betting spot, in placement order (the "chip stack" behind undo/remove). */
export interface ChipPlacement {
  bet: BetType;
  amount: number;
}

export const DEFAULT_BANKROLL = 1000;

/** The shoe is replaced after a hand when fewer than this many cards remain (a full hand needs at most 6). */
const MIN_CARDS_FOR_A_HAND = 6;

type Listener = (state: SessionState) => void;

function emptyBetStats(): BetTypeStats {
  return { count: 0, wagered: 0, net: 0, wins: 0, losses: 0, pushes: 0 };
}

function initialStats(bankroll: number): SessionStats {
  const byBet = {} as Record<BetType, BetTypeStats>;
  for (const bet of BET_TYPES) byBet[bet] = emptyBetStats();
  return {
    handsPlayed: 0,
    handsBet: 0,
    shoesPlayed: 1,
    playerWins: 0,
    bankerWins: 0,
    ties: 0,
    dragon7s: 0,
    panda8s: 0,
    playerPairs: 0,
    bankerPairs: 0,
    naturals: 0,
    totalWagered: 0,
    net: 0,
    commissionPaid: 0,
    startingBankroll: bankroll,
    peakBankroll: bankroll,
    lowBankroll: bankroll,
    maxDrawdown: 0,
    byBet,
    currentStreak: { outcome: null, length: 0 },
    longestPlayerStreak: 0,
    longestBankerStreak: 0,
  };
}

/**
 * Streaks follow the big-road convention of casino scoreboards (and of `roadStats` in `@/roads`): a tie never
 * breaks a Player/Banker streak, so `B T B` is a Banker streak of two. Only before the first Player/Banker
 * result do consecutive ties form a tie streak.
 */
function nextStreak(prev: StreakInfo, outcome: HandResult['outcome']): StreakInfo {
  if (outcome === 'tie') {
    return prev.outcome === null || prev.outcome === 'tie' ? { outcome: 'tie', length: prev.length + 1 } : prev;
  }
  return prev.outcome === outcome ? { outcome, length: prev.length + 1 } : { outcome, length: 1 };
}

function updateStats(prev: SessionStats, result: HandResult, settlement: HandSettlement, bankroll: number): SessionStats {
  const byBet = { ...prev.byBet };
  for (const s of settlement.settlements) {
    const b = prev.byBet[s.bet];
    byBet[s.bet] = {
      count: b.count + 1,
      wagered: roundCents(b.wagered + s.amount),
      net: roundCents(b.net + s.net),
      wins: b.wins + (s.result === 'win' ? 1 : 0),
      losses: b.losses + (s.result === 'lose' ? 1 : 0),
      pushes: b.pushes + (s.result === 'push' ? 1 : 0),
    };
  }
  const peakBankroll = Math.max(prev.peakBankroll, bankroll);
  const lowBankroll = Math.min(prev.lowBankroll, bankroll);
  const currentStreak = nextStreak(prev.currentStreak, result.outcome);
  return {
    ...prev,
    handsPlayed: prev.handsPlayed + 1,
    handsBet: prev.handsBet + (settlement.totalWagered > 0 ? 1 : 0),
    playerWins: prev.playerWins + (result.outcome === 'player' ? 1 : 0),
    bankerWins: prev.bankerWins + (result.outcome === 'banker' ? 1 : 0),
    ties: prev.ties + (result.outcome === 'tie' ? 1 : 0),
    dragon7s: prev.dragon7s + (result.dragon7 ? 1 : 0),
    panda8s: prev.panda8s + (result.panda8 ? 1 : 0),
    playerPairs: prev.playerPairs + (result.playerPair ? 1 : 0),
    bankerPairs: prev.bankerPairs + (result.bankerPair ? 1 : 0),
    naturals: prev.naturals + (result.playerNatural || result.bankerNatural ? 1 : 0),
    totalWagered: roundCents(prev.totalWagered + settlement.totalWagered),
    net: roundCents(prev.net + settlement.net),
    commissionPaid: roundCents(prev.commissionPaid + settlement.commission),
    peakBankroll,
    lowBankroll,
    maxDrawdown: Math.max(prev.maxDrawdown, roundCents(peakBankroll - bankroll)),
    byBet,
    currentStreak,
    longestPlayerStreak: currentStreak.outcome === 'player' ? Math.max(prev.longestPlayerStreak, currentStreak.length) : prev.longestPlayerStreak,
    longestBankerStreak: currentStreak.outcome === 'banker' ? Math.max(prev.longestBankerStreak, currentStreak.length) : prev.longestBankerStreak,
  };
}

/** Face-up cards of a hand in the order they hit the felt: P1, B1, P2, B2, P3, B3. */
function cardsInDealOrder(result: HandResult): Card[] {
  const p = result.playerCards;
  const b = result.bankerCards;
  const out: Card[] = [p[0], b[0], p[1], b[1]];
  if (p.length > 2) out.push(p[2]);
  if (b.length > 2) out.push(b[2]);
  return out;
}

/** Greedy chip decomposition (largest denomination first), used when a chip stack has to be rebuilt from amounts. */
function chipsForAmount(bet: BetType, amount: number, denominations: readonly number[]): ChipPlacement[] {
  const chips: ChipPlacement[] = [];
  let remaining = roundCents(amount);
  const sorted = [...denominations].sort((a, b) => b - a);
  for (const d of sorted) {
    while (remaining >= d - 1e-9) {
      chips.push({ bet, amount: d });
      remaining = roundCents(remaining - d);
    }
  }
  if (remaining > 0) chips.push({ bet, amount: remaining });
  return chips;
}

function assertValidRules(rules: TableRules): TableRules {
  const problems = validateRules(rules);
  if (problems.length > 0) throw new Error(`Invalid table rules: ${problems.join('; ')}`);
  return cloneRules(rules);
}

/**
 * A complete table session: rules, bankroll, the layout (with a chip stack so chips can be taken back one by
 * one), the shoe, hand history and statistics. Every mutation produces a NEW immutable `SessionState`
 * snapshot and notifies subscribers, so React can consume it with `useSyncExternalStore`.
 */
export class GameSession {
  private state!: SessionState;
  private rng!: Rng;
  private shoe!: Shoe;
  private chips: ChipPlacement[] = [];
  private lastChips: ChipPlacement[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(opts: SessionOptions = {}) {
    this.initialize(opts);
  }

  /** The current immutable snapshot (a new object after every mutation). */
  getState(): SessionState {
    return this.state;
  }

  /** Subscribes to state changes; returns the unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The chips on the layout in placement order. */
  getChipStack(): readonly ChipPlacement[] {
    return this.chips;
  }

  /** The chip denominations stacked on one spot, in placement order. */
  getChips(bet: BetType): readonly number[] {
    const out: number[] = [];
    for (const chip of this.chips) if (chip.bet === bet) out.push(chip.amount);
    return out;
  }

  /** Adds `amount` to the bet on `bet`. Enforces: bet offered, table maximum, and layout total ≤ bankroll. */
  placeBet(bet: BetType, amount: number): PlaceBetResult {
    const { rules, bets, bankroll } = this.state;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'Bet amount must be a positive number' };
    }
    const current = bets[bet] ?? 0;
    const problem = validateBet(bet, roundCents(current + amount), rules);
    if (problem !== null) return { ok: false, reason: problem };
    const onLayout = totalOnLayout(bets);
    if (roundCents(onLayout + amount) > bankroll) {
      const available = roundCents(bankroll - onLayout);
      return {
        ok: false,
        reason: available > 0 ? `Not enough bankroll: only ${formatMoney(available)} left to bet` : 'Not enough bankroll',
      };
    }
    this.chips = [...this.chips, { bet, amount }];
    this.setState({ bets: { ...bets, [bet]: roundCents(current + amount) } });
    return { ok: true };
  }

  /** Takes back the last chip placed on that spot. No-op when the spot is empty. */
  removeChip(bet: BetType): void {
    for (let i = this.chips.length - 1; i >= 0; i--) {
      if (this.chips[i].bet === bet) {
        this.removeChipAt(i);
        return;
      }
    }
  }

  /** Takes back the most recently placed chip, wherever it is. */
  undoLastChip(): void {
    if (this.chips.length === 0) return;
    this.removeChipAt(this.chips.length - 1);
  }

  private removeChipAt(index: number): void {
    const chip = this.chips[index];
    this.chips = [...this.chips.slice(0, index), ...this.chips.slice(index + 1)];
    const bets: Bets = { ...this.state.bets };
    const remaining = roundCents((bets[chip.bet] ?? 0) - chip.amount);
    if (remaining > 0) bets[chip.bet] = remaining;
    else delete bets[chip.bet];
    this.setState({ bets });
  }

  /** Takes every chip off the layout. */
  clearBets(): void {
    if (this.chips.length === 0 && totalOnLayout(this.state.bets) === 0) return;
    this.chips = [];
    this.setState({ bets: {} });
  }

  /** Replaces the layout with the previous hand's bets, if they are still allowed and affordable. */
  rebet(): PlaceBetResult {
    const { lastBets, rules, bankroll } = this.state;
    const active = BET_TYPES.filter((bet) => (lastBets[bet] ?? 0) > 0);
    if (active.length === 0) return { ok: false, reason: 'No previous bets to repeat' };
    for (const bet of active) {
      const problem = validateBet(bet, lastBets[bet] as number, rules);
      if (problem !== null) return { ok: false, reason: problem };
    }
    const total = totalOnLayout(lastBets);
    if (total > bankroll) {
      return { ok: false, reason: `Not enough bankroll to repeat ${formatMoney(total)} in bets` };
    }
    const sameChips = this.lastChips.length > 0 && active.every((bet) => roundCents(this.lastChips.filter((c) => c.bet === bet).reduce((s, c) => s + c.amount, 0)) === lastBets[bet]);
    this.chips = sameChips
      ? [...this.lastChips]
      : active.flatMap((bet) => chipsForAmount(bet, lastBets[bet] as number, rules.chipDenominations));
    const bets: Bets = {};
    for (const bet of active) bets[bet] = lastBets[bet];
    this.setState({ bets });
    return { ok: true };
  }

  /** Dealing needs at least one bet, every bet at or above its minimum, and the layout covered by the bankroll. */
  canDeal(): { ok: boolean; reason?: string } {
    const { bets, rules, bankroll } = this.state;
    const problems = validateLayout(bets, rules);
    if (problems.length > 0) return { ok: false, reason: problems[0] };
    if (totalOnLayout(bets) > bankroll) return { ok: false, reason: 'The bets on the layout exceed your bankroll' };
    return { ok: true };
  }

  /**
   * Deals and settles one hand, updating bankroll, statistics, history and seen cards, and moves the layout to
   * `lastBets`. The cut card is handled automatically: the hand that draws it marks the next hand as the last of
   * the shoe, and after that final hand a new shoe is shuffled (`newShoeStarted`).
   */
  deal(): DealOutcome {
    const check = this.canDeal();
    if (!check.ok) throw new Error(`Cannot deal: ${check.reason}`);

    const prev = this.state;
    const isFinalHand = prev.shoe.lastHandNext;
    const handNumber = prev.shoeHistory.length + 1;

    const result = dealHand(this.shoe, prev.rules, handNumber, { withSteps: true });
    const settlement = settleBets(prev.bets, result, prev.rules);
    const bankroll = roundCents(prev.bankroll + settlement.net);
    let stats = updateStats(prev.stats, result, settlement, bankroll);

    let shoeHistory = [...prev.shoeHistory, result];
    let seenCards = [...prev.seenCards, ...cardsInDealOrder(result)];
    let newShoeStarted = false;
    let shoeInfo: ShoeInfo;

    if (isFinalHand || this.shoe.cardsRemaining() < MIN_CARDS_FOR_A_HAND) {
      this.shoe = new Shoe(prev.rules, this.rng, this.shoe.shoeNumber + 1);
      newShoeStarted = true;
      shoeHistory = [];
      seenCards = this.initialSeenCards();
      stats = { ...stats, shoesPlayed: stats.shoesPlayed + 1 };
      shoeInfo = this.shoe.info(0, false);
    } else {
      shoeInfo = this.shoe.info(handNumber, result.cutCardDrawn);
    }

    this.lastChips = this.chips;
    this.chips = [];
    this.setState({
      bankroll,
      bets: {},
      lastBets: prev.bets,
      shoe: shoeInfo,
      shoeHistory,
      totalHands: prev.totalHands + 1,
      lastHand: { result, settlement },
      seenCards,
      stats,
    });
    return { result, settlement, newShoeStarted };
  }

  /** Shuffles a fresh shoe now (between hands). Bets on the layout stay. */
  newShoe(): void {
    const prev = this.state;
    const played = prev.shoeHistory.length > 0;
    this.shoe = new Shoe(prev.rules, this.rng, this.shoe.shoeNumber + 1);
    this.setState({
      shoe: this.shoe.info(0, false),
      shoeHistory: [],
      seenCards: this.initialSeenCards(),
      stats: played ? { ...prev.stats, shoesPlayed: prev.stats.shoesPlayed + 1 } : prev.stats,
    });
  }

  /** Changes the table rules between hands: the layout is cleared and a new shoe is shuffled. Throws on invalid rules. */
  setRules(rules: TableRules): void {
    const next = assertValidRules(rules);
    const prev = this.state;
    const played = prev.shoeHistory.length > 0;
    this.shoe = new Shoe(next, this.rng, this.shoe.shoeNumber + 1);
    this.chips = [];
    this.setState({
      rules: next,
      bets: {},
      shoe: this.shoe.info(0, false),
      shoeHistory: [],
      seenCards: this.initialSeenCards(),
      stats: played ? { ...prev.stats, shoesPlayed: prev.stats.shoesPlayed + 1 } : prev.stats,
    });
  }

  /**
   * Buy-in / cash-out: sets the bankroll. The difference counts as money brought to (or taken from) the table,
   * so `stats.net` stays the playing result and `bankroll === startingBankroll + net` keeps holding; the
   * peak/low figures shift with it. Bets on the layout are returned if the new bankroll cannot cover them.
   */
  setBankroll(amount: number): void {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new RangeError('Bankroll must be a non-negative number');
    }
    const prev = this.state;
    const bankroll = roundCents(amount);
    const delta = roundCents(bankroll - prev.bankroll);
    const stats: SessionStats = {
      ...prev.stats,
      startingBankroll: roundCents(prev.stats.startingBankroll + delta),
      peakBankroll: roundCents(prev.stats.peakBankroll + delta),
      lowBankroll: roundCents(prev.stats.lowBankroll + delta),
    };
    const keepBets = totalOnLayout(prev.bets) <= bankroll;
    if (!keepBets) this.chips = [];
    this.setState({ bankroll, bets: keepBets ? prev.bets : {}, stats });
  }

  /** Starts over: new rules/bankroll/seed (defaults as in the constructor). Subscribers are kept and notified. */
  reset(opts: SessionOptions = {}): void {
    this.initialize(opts);
    this.notify();
  }

  private initialize(opts: SessionOptions): void {
    const rules = assertValidRules(opts.rules ?? DEFAULT_RULES);
    const bankroll = opts.bankroll ?? DEFAULT_BANKROLL;
    if (typeof bankroll !== 'number' || !Number.isFinite(bankroll) || bankroll < 0) {
      throw new RangeError('Bankroll must be a non-negative number');
    }
    this.rng = createRng(opts.seed ?? randomSeed());
    this.shoe = new Shoe(rules, this.rng, 1);
    this.chips = [];
    this.lastChips = [];
    this.state = {
      rules,
      bankroll: roundCents(bankroll),
      bets: {},
      lastBets: {},
      shoe: this.shoe.info(0, false),
      shoeHistory: [],
      totalHands: 0,
      lastHand: null,
      seenCards: this.initialSeenCards(),
      stats: initialStats(roundCents(bankroll)),
      seed: this.rng.seed,
    };
  }

  private initialSeenCards(): Card[] {
    return this.shoe.exposedBurnCard ? [this.shoe.exposedBurnCard] : [];
  }

  private setState(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
