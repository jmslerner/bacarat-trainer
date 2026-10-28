/**
 * Builds the playback timeline of a hand: dealer calls and cards from `HandResult.steps`, then the settlement
 * (payouts shown, losers swept, bankroll counting), then — when the shoe ended — the new-shoe sequence.
 *
 * `base` is the per-step delay of the speed setting (0 = instant: every frame is at 0 and the runner applies them
 * all synchronously, so the table jumps straight to the settled hand).
 *
 * A Dragon 7 / Panda 8 is known from the result before a card is dealt, so the timeline stages the moment: the
 * third card of the winning side waits face down under a drum roll and flips as the total is called (normal and
 * slow speeds), then the bonus step carries a `Celebration` the felt plays — flash, medallion banner, particles —
 * and holds longer than an ordinary call before the settlement goes on as usual.
 */
import { BET_TYPES } from '@/engine';
import type { BetType, Bets, HandResult, HandSettlement, ShoeInfo, Side, TableRules } from '@/engine';
import { formatMoney } from '@/ui/shell';
import { explainSteps } from '../coach/tips';
import { emptyHand, type BonusKind, type Celebration, type Frame, type HandDisplay, type LayoutDisplay, type ShuffleDisplay } from './types';

/** Step durations as multiples of the base delay. */
export const TIMING = Object.freeze({
  clear: 0.35,
  deal: 0.9,
  show: 1.1,
  natural: 1.3,
  decision: 0.9,
  result: 1.4,
  bonus: 1.2,
  cutCard: 1.4,
  settle: 1.5,
  bankroll: 1.0,
  sweep: 0.7,
  shuffle: 1.6,
  cut: 1.0,
  burn: 1.6,
});

/** CSS duration of the card slide/flip for a base delay. */
export function dealDurationMs(base: number): number {
  if (base <= 0) return 0;
  return Math.round(Math.min(460, Math.max(180, base * 0.68)));
}

/** Pause between hands in auto-deal. */
export function autoPauseMs(base: number): number {
  return Math.max(250, Math.round(base * 1.2));
}

/**
 * How long the Dragon 7 / Panda 8 moment holds before the settlement: about 2.6 s at normal speed, 3.5 s slow,
 * 1.4 s fast. At instant speed the timeline does not wait at all — the banner still shows itself for 1.2 s
 * without delaying the settlement or the next deal.
 */
export function celebrationHoldMs(base: number): number {
  if (base <= 0) return 1200;
  return Math.round(Math.min(3500, Math.max(1400, base * 4)));
}

/**
 * The suspense before the card that makes a Dragon 7 / Panda 8 turns over: it lies face down this long after it
 * lands (normal and slow speeds); at fast and instant it is just the ordinary flip.
 */
export function revealMs(base: number): number {
  return base >= 500 ? Math.round(base * 1.6) : 0;
}

/**
 * The beginner tip while that card lies face down. The ordinary third-card tip names the card and the new total
 * ("Banker's third card is 4♥ … 3 + 4 → 7"), which would give the reveal away before it turns; this one does not
 * (and is no longer than it, so the dealer bar keeps its height when the card turns).
 */
export function faceDownTip(side: Side): string {
  return `${side === 'player' ? 'Player' : 'Banker'}’s third card lands face down — it turns over in a moment.`;
}

export type ChipStacks = Partial<Record<BetType, readonly number[]>>;

export interface HandTimelineInput {
  result: HandResult;
  settlement: HandSettlement;
  rules: TableRules;
  /** The layout as it was dealt. */
  bets: Bets;
  /** Chips per spot as placed (bottom first); spots missing here are drawn from `bets` with a greedy stack. */
  stacks: ChipStacks;
  bankrollBefore: number;
  bankrollAfter: number;
  base: number;
  /** Beginner tips on. */
  tips: boolean;
  /** The shoe that replaced the one this hand ended, or null when the shoe goes on. */
  newShoe: ShoeInfo | null;
}

function greedyChips(amount: number, denominations: readonly number[]): number[] {
  const out: number[] = [];
  let rest = Math.round(amount * 100) / 100;
  const sorted = [...denominations].sort((a, b) => b - a);
  for (const d of sorted) {
    while (rest >= d - 1e-9) {
      out.push(d);
      rest = Math.round((rest - d) * 100) / 100;
    }
  }
  if (rest > 0) out.push(rest);
  return out;
}

/** The layout snapshot shown while a hand is dealt (no results yet). */
export function layoutFromBets(bets: Bets, stacks: ChipStacks, denominations: readonly number[]): LayoutDisplay {
  const layout: LayoutDisplay = {};
  for (const bet of BET_TYPES) {
    const amount = bets[bet] ?? 0;
    if (amount <= 0) continue;
    const placed = stacks[bet];
    const chips = placed && placed.length > 0 ? [...placed] : greedyChips(amount, denominations);
    layout[bet] = { chips, amount, result: null, net: 0, swept: false };
  }
  return layout;
}

function settledLayout(layout: LayoutDisplay, settlement: HandSettlement, swept: boolean): LayoutDisplay {
  const out: LayoutDisplay = {};
  for (const bet of BET_TYPES) {
    const spot = layout[bet];
    if (!spot) continue;
    const s = settlement.settlements.find((x) => x.bet === bet);
    if (!s) {
      out[bet] = { ...spot };
      continue;
    }
    out[bet] = { ...spot, result: s.result, net: s.net, swept: swept && s.result === 'lose' };
  }
  return out;
}

export function describeSettlement(settlement: HandSettlement): string {
  if (settlement.totalWagered <= 0) return 'No bets this hand';
  const net = settlement.net;
  if (net > 0.004) return `You won ${formatMoney(net)}`;
  if (net < -0.004) return `You lost ${formatMoney(-net)}`;
  return 'Push — your bets are returned';
}

function settlementSound(settlement: HandSettlement): Frame['sound'] {
  if (settlement.totalWagered <= 0) return undefined;
  if (settlement.net > 0.004) return 'win';
  if (settlement.net < -0.004) return 'lose';
  return 'push';
}

let celebrationSeq = 0;

export interface CelebrationInput {
  result: HandResult;
  settlement: HandSettlement;
  rules: TableRules;
  /** The layout as dealt. */
  bets: Bets;
  holdMs: number;
}

/**
 * The Dragon 7 / Panda 8 moment of a hand, or null when there is none to call. The engine adds the bonus step only
 * when the table has something to say about it (the bet is offered, or the EZ Banker pushes), so a Dragon 7 at a
 * commission table with the side bet off is a plain Banker win here too.
 */
export function buildCelebration({ result, settlement, rules, bets, holdMs }: CelebrationInput): Celebration | null {
  const kind: BonusKind | null = result.dragon7 ? 'dragon7' : result.panda8 ? 'panda8' : null;
  if (kind === null) return null;
  if (!result.steps.some((s) => s.type === 'bonus' && s.kind === kind)) return null;
  const line = settlement.settlements.find((s) => s.bet === kind);
  const banker = settlement.settlements.find((s) => s.bet === 'banker');
  celebrationSeq += 1;
  return {
    id: `${kind}-${celebrationSeq}`,
    kind,
    side: kind === 'dragon7' ? 'banker' : 'player',
    pays: kind === 'dragon7' ? rules.dragon7Pays : rules.panda8Pays,
    won: line && line.result === 'win' ? line.net : 0,
    offered: rules.sideBets[kind],
    hadBet: (bets[kind] ?? 0) > 0,
    bankerPush: kind === 'dragon7' && banker !== undefined && banker.result === 'push',
    holdMs,
  };
}

/** Frames of the new-shoe procedure: shuffling, cut card placed, burn procedure. */
export function buildShuffleTimeline(shoe: ShoeInfo, rules: TableRules, base: number, startAt = 0): Frame[] {
  const frames: Frame[] = [];
  let t = startAt;
  const stage = (s: ShuffleDisplay): void => {
    frames.push({ at: t, phase: 'shuffling', shuffle: s, hand: emptyHand(s.message) });
  };
  stage({ stage: 'shuffling', message: `Shuffling shoe ${shoe.shoeNumber}…`, card: null, burned: 0 });
  frames[frames.length - 1].sound = 'shuffle';
  frames[frames.length - 1].keySound = true;
  frames[frames.length - 1].layout = null;
  // The previous hand's "You won / lost" line belongs to the shoe that just ended.
  frames[frames.length - 1].announce = '';
  t += base * TIMING.shuffle;
  stage({ stage: 'cut', message: `Cut card placed ${rules.cutCardFromEnd} cards from the end`, card: null, burned: 0 });
  t += base * TIMING.cut;
  if (rules.burnProcedure && shoe.exposedBurnCard) {
    stage({
      stage: 'burn',
      message: `Burning ${shoe.burnedCount} ${shoe.burnedCount === 1 ? 'card' : 'cards'}`,
      card: shoe.exposedBurnCard,
      burned: shoe.burnedCount,
    });
    frames[frames.length - 1].sound = 'deal';
    t += base * TIMING.burn;
  }
  frames.push({ at: t, phase: 'idle', shuffle: null, hand: emptyHand('New shoe — place your bets'), layout: null, event: 'done' });
  return frames;
}

/** The complete playback of one dealt hand, settlement included. */
export function buildHandTimeline(input: HandTimelineInput): Frame[] {
  const { result, settlement, rules, base, bankrollBefore, bankrollAfter } = input;
  const tips = input.tips ? explainSteps(result, rules) : result.steps.map(() => null);
  const frames: Frame[] = [];
  const layout = layoutFromBets(input.bets, input.stacks, rules.chipDenominations);
  const celebration = buildCelebration({ result, settlement, rules, bets: input.bets, holdMs: celebrationHoldMs(base) });
  const reveal = celebration ? revealMs(base) : 0;
  let t = 0;

  // Clear the previous hand, show the layout being played, close the betting.
  let hand = emptyHand('No more bets');
  frames.push({ at: 0, phase: 'dealing', hand, layout, bankroll: bankrollBefore, shuffle: null, celebrate: null });
  t += base * TIMING.clear;

  for (let i = 0; i < result.steps.length; i++) {
    const step = result.steps[i];
    hand = { ...hand, message: step.message, tip: tips[i], step: i, hit: null };
    let hold: number = TIMING.decision;
    let sound: Frame['sound'];
    switch (step.type) {
      case 'deal': {
        const to = step.to;
        if (to === 'player') hand.playerCards = [...hand.playerCards, step.card];
        else hand.bankerCards = [...hand.bankerCards, step.card];
        hold = TIMING.deal;
        sound = 'deal';
        if (step.index === 2) {
          if (reveal > 0 && celebration !== null && to === celebration.side) {
            // The card that makes the Dragon 7 / Panda 8 lands face down and waits under the drum roll; it turns
            // over as the dealer calls the total. Until then the beginner tip must not name it.
            hand.reveal = to;
            frames.push({ at: t, hand: { ...hand, tip: hand.tip === null ? null : faceDownTip(to) }, sound: 'riser' });
            t += reveal;
            hand = { ...hand };
            sound = 'flip';
          }
          // The third card changes the total at once, as the dealer calls it.
          if (to === 'player') hand.playerTotal = result.playerTotal;
          else hand.bankerTotal = result.bankerTotal;
        }
        break;
      }
      case 'show':
        hand.playerTotal = step.playerTotal;
        hand.bankerTotal = step.bankerTotal;
        hold = TIMING.show;
        sound = 'flip';
        break;
      case 'natural':
        hand.natural = step.side;
        hold = TIMING.natural;
        sound = 'bonus';
        break;
      case 'draw':
      case 'stand':
        hold = TIMING.decision;
        break;
      case 'result':
        hand.outcome = step.outcome;
        hand.playerTotal = step.playerTotal;
        hand.bankerTotal = step.bankerTotal;
        hold = TIMING.result;
        break;
      case 'bonus':
        hand[step.kind] = true;
        hold = TIMING.bonus;
        sound = 'bonus';
        if (celebration !== null && step.kind === celebration.kind) {
          // The moment: its own sound (the gong, the chimes), the overlay, and a longer hold than any call. At
          // instant speed nothing waits — the banner shows itself for its 1.2 s — and the sound is still played.
          hand.hit = step.kind;
          frames.push({ at: t, hand, sound: step.kind, keySound: base <= 0, celebrate: celebration });
          t += base > 0 ? celebration.holdMs : 0;
          continue;
        }
        break;
      case 'cutCard':
        hand.cutCard = true;
        hold = TIMING.cutCard;
        break;
    }
    frames.push({ at: t, hand, sound });
    t += base * hold;
  }

  // Settlement: badges on every spot, payout chips on the winners, the bankroll counts to its new value.
  const settledMessage = describeSettlement(settlement);
  const finalHand: HandDisplay = { ...hand, message: hand.message, step: result.steps.length };
  frames.push({
    at: t,
    phase: 'settling',
    hand: finalHand,
    layout: settledLayout(layout, settlement, false),
    // At instant speed the celebration's sound lands in the same tick: one voice, not two.
    sound: celebration !== null && base <= 0 ? undefined : settlementSound(settlement),
    keySound: true,
    announce: settledMessage,
    event: 'settled',
  });
  const countSteps = base > 0 ? 10 : 1;
  const countSpan = base * TIMING.bankroll;
  const wholeDollars = Number.isInteger(bankrollBefore) && Number.isInteger(bankrollAfter);
  for (let i = 1; i <= countSteps; i++) {
    const k = i / countSteps;
    const eased = 1 - (1 - k) * (1 - k);
    const raw = bankrollBefore + (bankrollAfter - bankrollBefore) * eased;
    const value = wholeDollars ? Math.round(raw) : Math.round(raw * 100) / 100;
    frames.push({ at: t + countSpan * k, bankroll: i === countSteps ? bankrollAfter : value });
  }
  t += base * TIMING.settle;

  // The dealer collects the losing chips.
  frames.push({ at: t, phase: 'settled', layout: settledLayout(layout, settlement, true) });
  t += base * TIMING.sweep;

  if (input.newShoe) {
    frames.push(...buildShuffleTimeline(input.newShoe, rules, base, t));
  } else {
    frames.push({ at: t, event: 'done' });
  }
  return frames;
}
