import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, dealFromValues, settleBets, type Bets, type ShoeInfo } from '@/engine';
import { autoPauseMs, buildHandTimeline, buildShuffleTimeline, dealDurationMs, describeSettlement, layoutFromBets, TIMING } from './timeline';
import type { Frame } from './types';

const shoeInfo: ShoeInfo = {
  shoeNumber: 2,
  totalCards: 416,
  cardsRemaining: 404,
  cardsDealt: 12,
  cutCardReached: false,
  lastHandNext: false,
  exposedBurnCard: { rank: '7', suit: 'D', id: 0 },
  burnedCount: 7,
  handsDealt: 0,
};

function lastHand(frames: Frame[]): Frame {
  return [...frames].reverse().find((f) => f.hand !== undefined) as Frame;
}

describe('buildHandTimeline', () => {
  // Player 5+0 draws a 3 → 8 (three-card 8 that WINS = Panda 8); Banker 3+0, Player's third is 3 → draws 7 → 0.
  const result = dealFromValues([5, 0, 3], [3, 0, 7]);
  const bets: Bets = { player: 25, panda8: 5, banker: 10 };
  const settlement = settleBets(bets, result, DEFAULT_RULES);

  it('deals the cards in casino order, calls the totals and lays the third cards after the decisions', () => {
    const frames = buildHandTimeline({ result, settlement, rules: DEFAULT_RULES, bets, stacks: { player: [25], panda8: [5], banker: [10] }, bankrollBefore: 1000, bankrollAfter: 1000 + settlement.net, base: 100, tips: true, newShoe: null });
    expect(frames[0]).toMatchObject({ at: 0, phase: 'dealing', bankroll: 1000 });
    expect(frames[0].layout).toEqual({
      player: { chips: [25], amount: 25, result: null, net: 0, swept: false },
      banker: { chips: [10], amount: 10, result: null, net: 0, swept: false },
      panda8: { chips: [5], amount: 5, result: null, net: 0, swept: false },
    });
    const ats = frames.map((f) => f.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats); // monotone
    const hands = frames.filter((f) => f.hand).map((f) => f.hand!);
    // Card counts as the hand unfolds: P1, B1, P2, B2 then totals, then the third cards.
    const counts = hands.map((h) => `${h.playerCards.length}${h.bankerCards.length}`);
    expect(counts.slice(0, 5)).toEqual(['00', '10', '11', '21', '22']);
    const show = hands.find((h) => h.message.startsWith('Player shows'));
    expect(show).toMatchObject({ playerTotal: 5, bankerTotal: 3 });
    // Before the totals are called they are unknown.
    expect(hands[4].playerTotal).toBeNull();
    // Player draws → third card → total 8 at once.
    const p3 = hands.find((h) => h.playerCards.length === 3);
    expect(p3).toMatchObject({ playerTotal: 8, message: 'Card to Player' });
    expect(p3!.tip).toMatch(/third card/);
    const final = lastHand(frames).hand!;
    expect(final).toMatchObject({ outcome: 'player', panda8: true, playerTotal: 8, bankerTotal: 0, playerCards: result.playerCards, bankerCards: result.bankerCards });
    const messages = hands.map((h) => h.message);
    expect(messages).toContain('Panda 8!');
    expect(messages).toContain('Player wins, 8 over 0');
    const sounds = frames.map((f) => f.sound).filter(Boolean);
    expect(sounds.filter((s) => s === 'deal')).toHaveLength(6);
  });

  it('reveals the settlement with results per spot, counts the bankroll and sweeps the losers', () => {
    const frames = buildHandTimeline({ result, settlement, rules: DEFAULT_RULES, bets, stacks: {}, bankrollBefore: 1000, bankrollAfter: 1000 + settlement.net, base: 100, tips: false, newShoe: null });
    const settled = frames.find((f) => f.event === 'settled')!;
    expect(settled.phase).toBe('settling');
    expect(settled.layout!.player).toMatchObject({ result: 'win', net: 25, swept: false });
    expect(settled.layout!.panda8).toMatchObject({ result: 'win', net: 125 });
    expect(settled.layout!.banker).toMatchObject({ result: 'lose', net: -10, swept: false });
    expect(settled.announce).toBe(`You won $${25 + 125 - 10}`);
    expect(settled.sound).toBe('win');
    expect(settled.keySound).toBe(true);
    // stacks missing from the snapshot are rebuilt greedily from the tray
    expect(settled.layout!.player!.chips).toEqual([25]);
    const bankrolls = frames.filter((f) => f.bankroll !== undefined && f.at >= settled.at).map((f) => f.bankroll!);
    expect(bankrolls[bankrolls.length - 1]).toBe(1140);
    expect(bankrolls.every((b, i) => i === 0 || b >= bankrolls[i - 1])).toBe(true);
    const swept = frames.find((f) => f.phase === 'settled')!;
    expect(swept.at).toBeGreaterThan(settled.at);
    expect(swept.layout!.banker!.swept).toBe(true);
    expect(swept.layout!.player!.swept).toBe(false);
    expect(frames[frames.length - 1]).toMatchObject({ event: 'done' });
    expect(frames.some((f) => f.hand?.tip)).toBe(false);
  });

  it('is entirely at 0 ms when instant', () => {
    const frames = buildHandTimeline({ result, settlement, rules: DEFAULT_RULES, bets, stacks: {}, bankrollBefore: 1000, bankrollAfter: 1140, base: 0, tips: true, newShoe: null });
    expect(frames.every((f) => f.at === 0)).toBe(true);
    const bankrolls = frames.filter((f) => f.bankroll !== undefined).map((f) => f.bankroll);
    expect(bankrolls).toEqual([1000, 1140]);
  });

  it('appends the new-shoe sequence when the deal ended the shoe', () => {
    const frames = buildHandTimeline({ result, settlement, rules: DEFAULT_RULES, bets, stacks: {}, bankrollBefore: 1000, bankrollAfter: 1140, base: 100, tips: false, newShoe: shoeInfo });
    const stages = frames.filter((f) => f.shuffle).map((f) => f.shuffle!.stage);
    expect(stages).toEqual(['shuffling', 'cut', 'burn']);
    const burn = frames.find((f) => f.shuffle?.stage === 'burn')!;
    expect(burn.shuffle).toMatchObject({ message: 'Burning 7 cards', burned: 7, card: shoeInfo.exposedBurnCard });
    const last = frames[frames.length - 1];
    expect(last).toMatchObject({ phase: 'idle', shuffle: null, layout: null, event: 'done' });
    expect(last.hand!.playerCards).toHaveLength(0);
    expect(last.hand!.message).toBe('New shoe — place your bets');
    const settledAt = frames.find((f) => f.event === 'settled')!.at;
    expect(frames.find((f) => f.shuffle)!.at).toBeGreaterThan(settledAt);
  });

  it('describes a push and a losing hand', () => {
    const tie = dealFromValues([4, 4], [8, 0]);
    expect(describeSettlement(settleBets({ player: 20 }, tie, DEFAULT_RULES))).toBe('Push — your bets are returned');
    expect(describeSettlement(settleBets({ tie: 5 }, result, DEFAULT_RULES))).toBe('You lost $5');
    expect(describeSettlement(settleBets({}, result, DEFAULT_RULES))).toBe('No bets this hand');
  });
});

describe('buildShuffleTimeline', () => {
  it('plays shuffling, cut card and burn, then opens the table', () => {
    const frames = buildShuffleTimeline(shoeInfo, DEFAULT_RULES, 100);
    expect(frames.map((f) => f.at)).toEqual([0, 100 * TIMING.shuffle, 100 * (TIMING.shuffle + TIMING.cut), 100 * (TIMING.shuffle + TIMING.cut + TIMING.burn)]);
    expect(frames[0]).toMatchObject({ phase: 'shuffling', sound: 'shuffle', keySound: true, layout: null, announce: '' });
    expect(frames[0].hand!.message).toBe('Shuffling shoe 2…');
    expect(frames[1].shuffle!.message).toBe('Cut card placed 14 cards from the end');
    expect(frames[3]).toMatchObject({ phase: 'idle', event: 'done' });
  });

  it('skips the burn stage when the procedure is off', () => {
    const frames = buildShuffleTimeline({ ...shoeInfo, exposedBurnCard: null, burnedCount: 0 }, { ...DEFAULT_RULES, burnProcedure: false }, 100);
    expect(frames.map((f) => f.shuffle?.stage ?? null)).toEqual(['shuffling', 'cut', null]);
  });
});

describe('helpers', () => {
  it('layoutFromBets keeps the placed chip order and falls back to a greedy stack', () => {
    const layout = layoutFromBets({ player: 30, tie: 7 }, { player: [5, 25] }, [1, 5, 25]);
    expect(layout.player!.chips).toEqual([5, 25]);
    expect(layout.tie!.chips).toEqual([5, 1, 1]);
    expect(layout.banker).toBeUndefined();
  });

  it('durations scale with the speed and have sane floors', () => {
    expect(dealDurationMs(0)).toBe(0);
    expect(dealDurationMs(300)).toBe(204);
    expect(dealDurationMs(1100)).toBe(460);
    expect(autoPauseMs(0)).toBe(250);
    expect(autoPauseMs(650)).toBe(780);
  });
});
