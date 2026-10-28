import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_PRESETS, dealFromValues, settleBets, type Bets, type HandResult, type HandSettlement, type ShoeInfo, type TableRules } from '@/engine';
import { autoPauseMs, buildCelebration, buildHandTimeline, buildShuffleTimeline, celebrationHoldMs, dealDurationMs, describeSettlement, faceDownTip, layoutFromBets, revealMs, TIMING } from './timeline';
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

describe('the Dragon 7 / Panda 8 moment', () => {
  // Player 3+1 = 4 draws a 2 → 6; Banker 4+0 = 4 draws on a 2 → 3 → 7: Banker wins with a three-card 7 = Dragon 7.
  const dragon = dealFromValues([3, 1, 2], [4, 0, 3]);
  const dragonBets: Bets = { banker: 25, dragon7: 5, player: 10 };
  const dragonSettlement = settleBets(dragonBets, dragon, DEFAULT_RULES);
  // Player 5+0 draws a 3 → 8 (three-card 8 that wins = Panda 8); Banker 3+0 draws a 7 → 0.
  const panda = dealFromValues([5, 0, 3], [3, 0, 7]);
  const build = (result: HandResult, bets: Bets, settlement: HandSettlement, base: number, rules: TableRules = DEFAULT_RULES): Frame[] =>
    buildHandTimeline({ result, settlement, rules, bets, stacks: {}, bankrollBefore: 1000, bankrollAfter: 1000 + settlement.net, base, tips: false, newShoe: null });

  it('emits the celebration on the bonus frame, with the Dragon 7 sound and a longer hold than any call at normal speed', () => {
    const frames = build(dragon, dragonBets, dragonSettlement, 650);
    const bonus = frames.find((f) => f.celebrate)!;
    expect(bonus.sound).toBe('dragon7');
    expect(bonus.keySound).toBeFalsy();
    expect(bonus.hand).toMatchObject({ hit: 'dragon7', dragon7: true, outcome: 'banker', bankerTotal: 7 });
    expect(bonus.celebrate).toMatchObject({ kind: 'dragon7', side: 'banker', pays: 40, won: 200, offered: true, hadBet: true, bankerPush: true, holdMs: 2600 });
    const settled = frames.find((f) => f.event === 'settled')!;
    expect(settled.at - bonus.at).toBe(2600);
    expect(settled.at - bonus.at).toBeGreaterThan(650 * TIMING.bonus);
    expect(settled.hand!.hit).toBe('dragon7'); // the big call stays through the settlement
    expect(settled.sound).toBe('win');
    // The moment is announced once: the previous frame cleared any celebration and no later frame sets one.
    expect(frames[0].celebrate).toBeNull();
    expect(frames.filter((f) => f.celebrate)).toHaveLength(1);
    expect(frames.filter((f) => f.sound === 'bonus')).toHaveLength(0);
  });

  it('holds about 3.5 s slow and 1.4 s fast; at instant the banner shows itself for 1.2 s without delaying the settlement', () => {
    expect(celebrationHoldMs(1100)).toBe(3500);
    expect(celebrationHoldMs(650)).toBe(2600);
    expect(celebrationHoldMs(300)).toBe(1400);
    expect(celebrationHoldMs(0)).toBe(1200);
    const slow = build(dragon, dragonBets, dragonSettlement, 1100);
    const slowBonus = slow.find((f) => f.celebrate)!;
    expect(slow.find((f) => f.event === 'settled')!.at - slowBonus.at).toBe(3500);
    const instant = build(dragon, dragonBets, dragonSettlement, 0);
    expect(instant.every((f) => f.at === 0)).toBe(true);
    const bonus = instant.find((f) => f.celebrate)!;
    expect(bonus.celebrate!.holdMs).toBe(1200);
    expect(bonus.keySound).toBe(true); // the gong is heard even though every frame is applied at once
    expect(instant.find((f) => f.event === 'settled')!.sound).toBeUndefined(); // one voice in that tick, not two
    expect(instant.find((f) => f.sound === 'riser')).toBeUndefined();
  });

  it('reveals the card that makes the hit face down under the drum roll, then flips it as the total is called — at normal and slow speeds only', () => {
    expect(revealMs(1100)).toBe(1760);
    expect(revealMs(650)).toBe(1040);
    expect(revealMs(300)).toBe(0);
    expect(revealMs(0)).toBe(0);
    const frames = build(dragon, dragonBets, dragonSettlement, 650);
    const riser = frames.find((f) => f.sound === 'riser')!;
    expect(riser.hand).toMatchObject({ reveal: 'banker', bankerTotal: 4, message: 'Card to Banker' });
    expect(riser.hand!.bankerCards).toHaveLength(3);
    const flip = frames.find((f) => f.at === riser.at + 1040)!;
    expect(flip.sound).toBe('flip');
    expect(flip.hand).toMatchObject({ reveal: 'banker', bankerTotal: 7 });
    expect(flip.hand!.bankerCards).toEqual(riser.hand!.bankerCards);
    const result = frames.find((f) => f.hand?.outcome === 'banker')!;
    expect(result.at).toBe(flip.at + 650 * TIMING.deal);
    // The Player's third card is an ordinary deal.
    const p3 = frames.find((f) => f.hand?.playerCards.length === 3)!;
    expect(p3.sound).toBe('deal');
    expect(p3.hand!.reveal).toBeNull();
    const fast = build(dragon, dragonBets, dragonSettlement, 300);
    expect(fast.some((f) => f.sound === 'riser')).toBe(false);
    expect(fast.every((f) => !f.hand || f.hand.reveal === null)).toBe(true);
    expect(fast.filter((f) => f.sound === 'deal')).toHaveLength(6);
  });

  it('with beginner tips on, the tip never names the face-down card before it turns', () => {
    const frames = buildHandTimeline({ result: dragon, settlement: dragonSettlement, rules: DEFAULT_RULES, bets: dragonBets, stacks: {}, bankrollBefore: 1000, bankrollAfter: 1000 + dragonSettlement.net, base: 650, tips: true, newShoe: null });
    const riser = frames.find((f) => f.sound === 'riser')!;
    const card = dragon.bankerCards[2];
    expect(riser.hand!.tip).toBe(faceDownTip('banker'));
    expect(riser.hand!.tip).not.toMatch(/→|counts/);
    // The flip brings the real explanation: the card, its value and the new total.
    const flip = frames.find((f) => f.at === riser.at + 1040)!;
    expect(flip.hand!.tip).toMatch(/^Banker’s third card is 3. \(3 counts 3\): 4 \+ 3 → 7\./);
    expect(card.rank).toBe('3');
    // An ordinary third card (the Player's here) is explained as it lands.
    const p3 = frames.find((f) => f.hand?.playerCards.length === 3)!;
    expect(p3.hand!.tip).toMatch(/^Player’s third card is 2/);
    // Tips off: no tip at all, face down or not.
    expect(build(dragon, dragonBets, dragonSettlement, 650).find((f) => f.sound === 'riser')!.hand!.tip).toBeNull();
  });

  it('a Panda 8 celebrates on the Player side with the chime cascade, its own payout and no Banker push', () => {
    const bets: Bets = { player: 25, panda8: 5, banker: 10 };
    const settlement = settleBets(bets, panda, DEFAULT_RULES);
    const frames = build(panda, bets, settlement, 650);
    const bonus = frames.find((f) => f.celebrate)!;
    expect(bonus.sound).toBe('panda8');
    expect(bonus.hand!.hit).toBe('panda8');
    expect(bonus.celebrate).toMatchObject({ kind: 'panda8', side: 'player', pays: 25, won: 125, hadBet: true, bankerPush: false });
    const riser = frames.find((f) => f.sound === 'riser')!;
    expect(riser.hand!.reveal).toBe('player');
    expect(riser.hand!.playerTotal).toBe(5);
    expect(frames.find((f) => f.at === riser.at + 1040)!.hand!.playerTotal).toBe(8);
  });

  it('buildCelebration knows a hand without the bet, a Dragon 7 with no Banker bet, and tables where the hit is not called', () => {
    const noBet = buildCelebration({ result: dragon, settlement: settleBets({ player: 10 }, dragon, DEFAULT_RULES), rules: DEFAULT_RULES, bets: { player: 10 }, holdMs: 2600 });
    expect(noBet).toMatchObject({ kind: 'dragon7', won: 0, hadBet: false, bankerPush: false });
    const bankerOnly = buildCelebration({ result: dragon, settlement: settleBets({ banker: 50 }, dragon, DEFAULT_RULES), rules: DEFAULT_RULES, bets: { banker: 50 }, holdMs: 2600 });
    expect(bankerOnly).toMatchObject({ won: 0, hadBet: false, bankerPush: true });
    const ids = new Set([noBet!.id, bankerOnly!.id]);
    expect(ids.size).toBe(2);
    // Classic commission table with the side bets off: the engine makes no "Dragon 7!" call, so there is no moment.
    const commission = RULE_PRESETS.commission.rules;
    const plain = dealFromValues([3, 1, 2], [4, 0, 3], commission);
    expect(plain.dragon7).toBe(true);
    expect(plain.steps.some((s) => s.type === 'bonus')).toBe(false);
    expect(buildCelebration({ result: plain, settlement: settleBets({ banker: 50 }, plain, commission), rules: commission, bets: { banker: 50 }, holdMs: 2600 })).toBeNull();
    const frames = build(plain, { banker: 50 }, settleBets({ banker: 50 }, plain, commission), 650, commission);
    expect(frames.some((f) => f.celebrate)).toBe(false);
    expect(frames.some((f) => f.sound === 'riser')).toBe(false);
    expect(buildCelebration({ result: panda, settlement: settleBets({}, panda, DEFAULT_RULES), rules: DEFAULT_RULES, bets: {}, holdMs: 1200 })).toMatchObject({ kind: 'panda8', pays: 25, won: 0, offered: true, hadBet: false, holdMs: 1200 });
    // An EZ table with the Dragon 7 bet switched off still calls the Dragon 7 (the Banker push): a moment without a bet.
    const noSide: TableRules = { ...DEFAULT_RULES, sideBets: { ...DEFAULT_RULES.sideBets, dragon7: false } };
    const ez = dealFromValues([3, 1, 2], [4, 0, 3], noSide);
    expect(ez.steps.some((s) => s.type === 'bonus' && s.kind === 'dragon7')).toBe(true);
    expect(buildCelebration({ result: ez, settlement: settleBets({ banker: 50 }, ez, noSide), rules: noSide, bets: { banker: 50 }, holdMs: 2600 })).toMatchObject({ kind: 'dragon7', offered: false, hadBet: false, won: 0, bankerPush: true });
  });

  it('pairs and naturals keep the plain bonus sparkle and never celebrate', () => {
    const pair = dealFromValues([2, 2, 2], [4, 0, 3]); // Player Pair, then a Dragon 7
    const bets: Bets = { playerPair: 5 };
    const frames = build(pair, bets, settleBets(bets, pair, DEFAULT_RULES), 650);
    const pairFrame = frames.find((f) => f.hand?.message === 'Player Pair')!;
    expect(pairFrame.sound).toBe('bonus');
    expect(pairFrame.celebrate).toBeUndefined();
    expect(pairFrame.hand!.hit).toBeNull();
    const next = frames[frames.indexOf(pairFrame) + 1];
    expect(next.at - pairFrame.at).toBe(650 * TIMING.bonus);
    expect(frames.filter((f) => f.celebrate)).toHaveLength(1);
    const natural = dealFromValues([9, 0], [4, 4]);
    const nat = build(natural, {}, settleBets({}, natural, DEFAULT_RULES), 650);
    expect(nat.find((f) => f.hand?.natural)!.sound).toBe('bonus');
    expect(nat.some((f) => f.celebrate)).toBe(false);
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
