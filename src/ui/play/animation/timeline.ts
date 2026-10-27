/**
 * Builds the playback timeline of a hand: dealer calls and cards from `HandResult.steps`, then the settlement
 * (payouts shown, losers swept, bankroll counting), then — when the shoe ended — the new-shoe sequence.
 *
 * `base` is the per-step delay of the speed setting (0 = instant: every frame is at 0 and the runner applies them
 * all synchronously, so the table jumps straight to the settled hand).
 */
import { BET_TYPES } from '@/engine';
import type { BetType, Bets, HandResult, HandSettlement, ShoeInfo, TableRules } from '@/engine';
import { formatMoney } from '@/ui/shell';
import { explainSteps } from '../coach/tips';
import { emptyHand, type Frame, type HandDisplay, type LayoutDisplay, type ShuffleDisplay } from './types';

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
  let t = 0;

  // Clear the previous hand, show the layout being played, close the betting.
  let hand = emptyHand('No more bets');
  frames.push({ at: 0, phase: 'dealing', hand, layout, bankroll: bankrollBefore, shuffle: null });
  t += base * TIMING.clear;

  result.steps.forEach((step, i) => {
    hand = { ...hand, message: step.message, tip: tips[i], step: i };
    let hold: number = TIMING.decision;
    let sound: Frame['sound'];
    switch (step.type) {
      case 'deal':
        if (step.to === 'player') hand.playerCards = [...hand.playerCards, step.card];
        else hand.bankerCards = [...hand.bankerCards, step.card];
        if (step.index === 2) {
          // The third card changes the total at once, as the dealer calls it.
          if (step.to === 'player') hand.playerTotal = result.playerTotal;
          else hand.bankerTotal = result.bankerTotal;
        }
        hold = TIMING.deal;
        sound = 'deal';
        break;
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
        break;
      case 'cutCard':
        hand.cutCard = true;
        hold = TIMING.cutCard;
        break;
    }
    frames.push({ at: t, hand, sound });
    t += base * hold;
  });

  // Settlement: badges on every spot, payout chips on the winners, the bankroll counts to its new value.
  const settledMessage = describeSettlement(settlement);
  const finalHand: HandDisplay = { ...hand, message: hand.message, step: result.steps.length };
  frames.push({
    at: t,
    phase: 'settling',
    hand: finalHand,
    layout: settledLayout(layout, settlement, false),
    sound: settlementSound(settlement),
    keySound: true,
    announce: settledMessage,
    event: 'settled',
  });
  const countSteps = base > 0 ? 10 : 1;
  const countSpan = base * TIMING.bankroll;
  for (let i = 1; i <= countSteps; i++) {
    const k = i / countSteps;
    const eased = 1 - (1 - k) * (1 - k);
    const value = Math.round((bankrollBefore + (bankrollAfter - bankrollBefore) * eased) * 100) / 100;
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
