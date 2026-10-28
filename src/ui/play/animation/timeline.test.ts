import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RANKS, RULE_PRESETS, dealFromValues, settleBets, type Bets, type HandResult, type HandSettlement, type ShoeInfo, type TableRules } from '@/engine';
import { explainSteps } from '../coach/tips';
import { autoPauseMs, buildCelebration, buildHandTimeline, buildShuffleTimeline, celebrationHoldMs, dealDurationMs, describeSettlement, faceDownTip, layoutFromBets, revealMs, squeezeSides, TIMING } from './timeline';
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

  it('with the Dragon 7 bet down, its card is squeezed: face down under the drum roll, turned as the total is called — at normal and slow speeds only', () => {
    expect(revealMs(1100)).toBe(1760);
    expect(revealMs(650)).toBe(1040);
    expect(revealMs(300)).toBe(0);
    expect(revealMs(0)).toBe(0);
    const frames = build(dragon, dragonBets, dragonSettlement, 650);
    const riser = frames.find((f) => f.sound === 'riser')!;
    expect(riser.hand).toMatchObject({ reveal: 'banker', faceDown: 'banker', bankerTotal: 4, message: 'Card to Banker' });
    expect(riser.hand!.bankerCards).toHaveLength(3);
    const flip = frames.find((f) => f.at === riser.at + 1040)!;
    expect(flip.sound).toBe('flip');
    expect(flip.hand).toMatchObject({ reveal: 'banker', faceDown: null, bankerTotal: 7 });
    expect(flip.hand!.bankerCards).toEqual(riser.hand!.bankerCards);
    const result = frames.find((f) => f.hand?.outcome === 'banker')!;
    expect(result.at).toBe(flip.at + 650 * TIMING.deal);
    // The Player's third card is an ordinary deal.
    const p3 = frames.find((f) => f.hand?.playerCards.length === 3)!;
    expect(p3.sound).toBe('deal');
    expect(p3.hand!.reveal).toBeNull();
    expect(p3.hand!.faceDown).toBeNull();
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
    expect(riser.hand!.tip).toBe('Banker’s third card is squeezed: it could still make a Dragon 7.');
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
    expect(riser.hand!.faceDown).toBe('player');
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

describe('the squeeze', () => {
  const build = (result: HandResult, bets: Bets, base = 650, tips = false): Frame[] =>
    buildHandTimeline({ result, settlement: settleBets(bets, result, DEFAULT_RULES), rules: DEFAULT_RULES, bets, stacks: {}, bankrollBefore: 1000, bankrollAfter: 1000, base, tips, newShoe: null });
  const risers = (frames: Frame[]): Frame[] => frames.filter((f) => f.sound === 'riser');
  // Player 2+1 = 3 draws a 4 → 7; Banker 7 stands.
  const playerDraws = dealFromValues([2, 1, 4], [7, 0]);
  // Player 3+1 = 4 draws a 2 → 6; Banker 4 draws a 5 → 9: no Dragon 7.
  const bothDraw = dealFromValues([3, 1, 2], [4, 0, 5]);
  // The same cards with a 3 as the Banker's third card: 4 + 3 → 7 beats 6, a Dragon 7.
  const dragon = dealFromValues([3, 1, 2], [4, 0, 3]);
  // Player 5+0 draws a 3 → 8 over the Banker's 0, a Panda 8; with a 2 instead, Player 7 and no Panda 8.
  const panda = dealFromValues([5, 0, 3], [3, 0, 7]);
  const pandaMiss = dealFromValues([5, 0, 2], [3, 0, 7]);
  const allBets: Bets = { banker: 25, dragon7: 5, panda8: 5 };
  /** A frame without the third card of one side: what is left must be the same for a hit and a miss. */
  const withoutThird = (f: Frame, side: 'player' | 'banker'): Frame => ({ ...f, hand: { ...f.hand!, [side === 'player' ? 'playerCards' : 'bankerCards']: (side === 'player' ? f.hand!.playerCards : f.hand!.bankerCards).slice(0, 2) } });

  it('squeezeSides: the Player’s third card with a Panda 8 bet down; the Banker’s with a Dragon 7 bet down while the Player has 6 or less', () => {
    expect(dragon.dragon7).toBe(true);
    expect(panda.panda8).toBe(true);
    expect(squeezeSides(playerDraws, { player: 10, panda8: 5 })).toEqual({ player: true, banker: false });
    expect(squeezeSides(playerDraws, { player: 10, dragon7: 5 })).toEqual({ player: false, banker: false });
    expect(squeezeSides(bothDraw, { banker: 10, dragon7: 5 })).toEqual({ player: false, banker: true });
    // The Player stood on 6: the Banker's card can still make a Dragon 7.
    expect(squeezeSides(dealFromValues([6, 0], [3, 0, 4]), { dragon7: 5 })).toEqual({ player: false, banker: true });
    // A Player 7 rules the Dragon 7 out — even when the Banker then makes a three-card 7 (a tie).
    const player7 = dealFromValues([3, 1, 3], [4, 0, 5]);
    expect(player7.playerTotal).toBe(7);
    expect(squeezeSides(player7, { banker: 10, dragon7: 5 })).toEqual({ player: false, banker: false });
    const tie7 = dealFromValues([6, 1], [2, 0, 5]);
    expect(tie7).toMatchObject({ playerTotal: 7, bankerTotal: 7, outcome: 'tie', dragon7: false });
    expect(squeezeSides(tie7, { dragon7: 5 })).toEqual({ player: false, banker: false });
    // Both bets, both sides draw: both cards.
    expect(squeezeSides(bothDraw, allBets)).toEqual({ player: true, banker: true });
    // A natural: no third card at all.
    expect(squeezeSides(dealFromValues([9, 0], [4, 4]), allBets)).toEqual({ player: false, banker: false });
    // No side bets: no squeeze, hit or not.
    expect(squeezeSides(bothDraw, { banker: 25, player: 10 })).toEqual({ player: false, banker: false });
    expect(squeezeSides(dragon, { banker: 25 })).toEqual({ player: false, banker: false });
    expect(squeezeSides(panda, { player: 25 })).toEqual({ player: false, banker: false });
  });

  it('a miss is squeezed like a hit: face down under the drum roll with the totals held, then turned and dealt on', () => {
    const frames = build(bothDraw, { banker: 10, dragon7: 5 }, 650, true);
    expect(risers(frames)).toHaveLength(1);
    const [riser] = risers(frames);
    expect(riser.hand).toMatchObject({ reveal: 'banker', faceDown: 'banker', playerTotal: 6, bankerTotal: 4, message: 'Card to Banker', tip: faceDownTip('banker'), hit: null, dragon7: false, panda8: false });
    expect(riser.hand!.bankerCards).toEqual(bothDraw.bankerCards);
    expect(riser.celebrate).toBeUndefined();
    const flip = frames[frames.indexOf(riser) + 1];
    expect(flip.at - riser.at).toBe(revealMs(650));
    expect(flip.sound).toBe('flip');
    expect(flip.hand).toMatchObject({ reveal: 'banker', faceDown: null, bankerTotal: 9 });
    expect(flip.hand!.tip).toMatch(/^Banker’s third card is 5. \(5 counts 5\): 4 \+ 5 → 9\./);
    // No Panda 8 bet: the Player's third card was an ordinary deal.
    const p3 = frames.find((f) => f.hand?.playerCards.length === 3)!;
    expect(p3.sound).toBe('deal');
    expect(p3.hand).toMatchObject({ reveal: null, faceDown: null, playerTotal: 6 });
    // The Player's third card with a Panda 8 bet: squeezed, Panda 8 or not.
    const player = risers(build(playerDraws, { player: 10, panda8: 5 }));
    expect(player).toHaveLength(1);
    expect(player[0].hand).toMatchObject({ reveal: 'player', faceDown: 'player', playerTotal: 3, bankerTotal: 7 });
  });

  it('a Dragon 7 or Panda 8 without its bet is dealt face up — and still celebrated', () => {
    for (const [result, bets, kind] of [
      [dragon, { banker: 25 }, 'dragon7'],
      [dragon, { player: 10 }, 'dragon7'],
      [panda, { player: 25, dragon7: 5 }, 'panda8'],
    ] as const) {
      const frames = build(result, bets);
      expect(risers(frames)).toHaveLength(0);
      expect(frames.every((f) => !f.hand || (f.hand.reveal === null && f.hand.faceDown === null))).toBe(true);
      expect(frames.filter((f) => f.sound === 'deal')).toHaveLength(6);
      expect(frames.find((f) => f.celebrate)!.celebrate).toMatchObject({ kind, hadBet: false });
    }
    // The Dragon 7 with only a Panda 8 bet: the Player's card is squeezed (it could have made the Panda 8), the
    // Dragon 7 card is not.
    const frames = build(dragon, { banker: 25, panda8: 5 });
    expect(risers(frames).map((f) => f.hand!.faceDown)).toEqual(['player']);
    expect(frames.find((f) => f.hand?.bankerCards.length === 3)!.sound).toBe('deal');
  });

  it('fast and instant speeds never squeeze', () => {
    for (const base of [300, 0]) {
      const frames = build(bothDraw, allBets, base);
      expect(risers(frames)).toHaveLength(0);
      expect(frames.every((f) => !f.hand || (f.hand.reveal === null && f.hand.faceDown === null))).toBe(true);
    }
  });

  it('the face-down frames of a hit and a miss differ only in the card itself', () => {
    for (const tips of [true, false]) {
      // The Banker's card: the Dragon 7's 3 and a missing 5, with the Player's card squeezed before it (Panda 8 bet).
      const hit = risers(build(dragon, allBets, 650, tips));
      const miss = risers(build(bothDraw, allBets, 650, tips));
      expect(hit.map((f) => f.hand!.faceDown)).toEqual(['player', 'banker']);
      expect(miss.map((f) => f.hand!.faceDown)).toEqual(['player', 'banker']);
      expect(hit[0]).toStrictEqual(miss[0]); // the same Player card
      expect(withoutThird(hit[1], 'banker')).toStrictEqual(withoutThird(miss[1], 'banker'));
      expect(hit[1].hand!.bankerCards[2].rank).toBe('3');
      expect(miss[1].hand!.bankerCards[2].rank).toBe('5');
      // The Player's card: the Panda 8's 3 and a missing 2.
      const pHit = risers(build(panda, allBets, 650, tips));
      const pMiss = risers(build(pandaMiss, allBets, 650, tips));
      expect(pHit).toHaveLength(1);
      expect(pMiss).toHaveLength(1);
      expect(withoutThird(pHit[0], 'player')).toStrictEqual(withoutThird(pMiss[0], 'player'));
      expect(pHit[0].hand!.playerCards[2].rank).toBe('3');
      expect(pMiss[0].hand!.playerCards[2].rank).toBe('2');
    }
  });

  it('a miss after its turn carries no hit and no glow, and the hand goes on to its result', () => {
    const frames = build(bothDraw, allBets);
    const turned = frames.slice(frames.indexOf(risers(frames)[1]) + 1).filter((f) => f.hand);
    expect(turned.length).toBeGreaterThan(0);
    for (const f of turned) expect(f.hand).toMatchObject({ faceDown: null, hit: null, dragon7: false, panda8: false });
    expect(frames.some((f) => f.celebrate)).toBe(false);
    expect(frames.some((f) => f.sound === 'dragon7' || f.sound === 'panda8')).toBe(false);
    expect(lastHand(frames).hand).toMatchObject({ outcome: 'banker', playerTotal: 6, bankerTotal: 9 });
  });

  it('with both bets the Player’s card is squeezed and turned, then the Banker’s — each with the usual wait', () => {
    const frames = build(bothDraw, allBets);
    const [p, b] = risers(frames);
    expect(p.hand).toMatchObject({ reveal: 'player', faceDown: 'player', playerTotal: 4, bankerTotal: 4 });
    expect(p.hand!.playerCards).toHaveLength(3);
    expect(b.hand).toMatchObject({ reveal: 'both', faceDown: 'banker', playerTotal: 6, bankerTotal: 4 });
    expect(b.hand!.bankerCards).toHaveLength(3);
    // Between the two, the Player's card has turned: no frame shows both face down.
    expect(frames.filter((f) => f.at > p.at && f.at < b.at && f.hand).every((f) => f.hand!.faceDown === null)).toBe(true);
    const settledAt = (fs: Frame[]): number => fs.find((f) => f.event === 'settled')!.at;
    expect(settledAt(frames) - settledAt(build(bothDraw, { banker: 25 }))).toBe(2 * revealMs(650));
    expect(settledAt(build(bothDraw, allBets, 1100)) - settledAt(build(bothDraw, { banker: 25 }, 1100))).toBe(2 * revealMs(1100));
  });

  it('the face-down tip says why the card is squeezed — the same on hits and misses — and is never longer than an ordinary third-card tip', () => {
    expect(faceDownTip('player')).toBe('Player’s third card is squeezed: it could still make a Panda 8.');
    expect(faceDownTip('banker')).toBe('Banker’s third card is squeezed: it could still make a Dragon 7.');
    // Every ordinary third-card tip: each rank as the Player's third card (Player 0–5, Banker 7 stands) and as the
    // Banker's (Player 7 stands, Banker 0–5).
    const thirdCardTips: string[] = [];
    for (const rank of RANKS) {
      for (const total of [0, 1, 2, 3, 4, 5]) {
        for (const result of [dealFromValues([total, 0, rank], [7, 0]), dealFromValues([6, 1], [total, 0, rank])]) {
          const tips = explainSteps(result, DEFAULT_RULES);
          result.steps.forEach((step, i) => {
            if (step.type === 'deal' && step.index === 2) thirdCardTips.push(tips[i]!);
          });
        }
      }
    }
    expect(thirdCardTips).toHaveLength(RANKS.length * 6 * 2);
    const shortest = Math.min(...thirdCardTips.map((tip) => tip.length));
    expect(faceDownTip('player').length).toBeLessThanOrEqual(shortest);
    expect(faceDownTip('banker').length).toBeLessThanOrEqual(shortest);
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
