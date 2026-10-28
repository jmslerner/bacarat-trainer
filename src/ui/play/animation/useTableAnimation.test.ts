import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, GameSession } from '@/engine';
import { animReducer, cardsOnFelt, deriveView, faceUpCards, initialAnimState, type AnimState } from './useTableAnimation';
import { emptyHand, type Celebration } from './types';

const celebration: Celebration = { id: 'dragon7-1', kind: 'dragon7', side: 'banker', pays: 40, won: 200, offered: true, hadBet: true, bankerPush: true, holdMs: 2600 };

describe('animReducer — the Dragon 7 / Panda 8 moment', () => {
  it('a frame shows the celebration, the next deal, a reset and a skip clear it, the end of the timeline keeps it', () => {
    let s = initialAnimState();
    expect(s.celebration).toBeNull();
    s = animReducer(s, { type: 'begin', held: null, current: null, base: 650 });
    s = animReducer(s, { type: 'frame', frame: { at: 0, hand: { ...emptyHand(), reveal: 'both', faceDown: 'banker' } } });
    s = animReducer(s, { type: 'frame', frame: { at: 0, celebrate: celebration } });
    expect(s.celebration).toBe(celebration);
    // Frames that say nothing about it leave it alone; re-renders see the same object.
    s = animReducer(s, { type: 'frame', frame: { at: 0, bankroll: 1200 } });
    expect(s.celebration).toBe(celebration);
    // Instant speed: the timeline is over at once but the banner still shows itself.
    expect(animReducer(s, { type: 'done' }).celebration).toBe(celebration);
    // The next deal clears it before a card is dealt.
    expect(animReducer(s, { type: 'begin', held: null, current: null, base: 650 }).celebration).toBeNull();
    expect(animReducer(s, { type: 'frame', frame: { at: 0, celebrate: null } }).celebration).toBeNull();
    expect(animReducer(s, { type: 'reset', message: 'Place your bets' }).celebration).toBeNull();
    // A fast-forward drops the banner and turns a squeezed card face up at once.
    const skipped = animReducer(s, { type: 'skip' });
    expect(skipped.celebration).toBeNull();
    expect(skipped.hand.reveal).toBeNull();
    expect(skipped.hand.faceDown).toBeNull();
    expect(skipped.hand.playerCards).toBe(s.hand.playerCards);
    // Nothing to skip: the same state object, so no render.
    expect(animReducer(skipped, { type: 'skip' })).toBe(skipped);
  });

  it('remembers the speed the hand in play was dealt at until the next one (the felt animates at it), forgets it on a reset', () => {
    let s = initialAnimState();
    expect(s.base).toBeNull();
    s = animReducer(s, { type: 'begin', held: null, current: null, base: 650 });
    expect(s.base).toBe(650);
    s = animReducer(s, { type: 'frame', frame: { at: 0, hand: emptyHand() } });
    s = animReducer(s, { type: 'skip' });
    s = animReducer(s, { type: 'done' });
    expect(s.base).toBe(650);
    expect(animReducer(s, { type: 'begin', held: null, current: null, base: 300 }).base).toBe(300);
    expect(animReducer(s, { type: 'reset', message: 'Place your bets' }).base).toBeNull();
  });
});

describe('a squeezed card lying face down', () => {
  // Seed 3, hand 1: Player 8 6 draws a 6 (4 → 0), Banker 10 6 draws a 5 (6 → 1).
  const session = new GameSession({ rules: DEFAULT_RULES, bankroll: 1000, seed: 3 });
  session.placeBet('banker', 25);
  session.placeBet('dragon7', 5);
  const prev = session.getState();
  const { result, settlement } = session.deal();
  const live = session.getState();
  const onFelt = { ...emptyHand(), playerCards: result.playerCards, bankerCards: result.bankerCards };

  it('is left out of the cards anyone can see until it turns', () => {
    expect(result.playerCards).toHaveLength(3);
    expect(result.bankerCards).toHaveLength(3);
    expect(faceUpCards(onFelt)).toEqual(cardsOnFelt(onFelt));
    expect(faceUpCards({ ...onFelt, faceDown: 'banker' })).toEqual(cardsOnFelt(onFelt).slice(0, 5));
    expect(faceUpCards({ ...onFelt, faceDown: 'player' })).toEqual([...cardsOnFelt(onFelt).slice(0, 4), result.bankerCards[2]]);
    // Not yet on the felt: nothing to leave out.
    const twoCards = { ...emptyHand(), playerCards: result.playerCards.slice(0, 2), bankerCards: result.bankerCards.slice(0, 2), faceDown: 'banker' as const };
    expect(faceUpCards(twoCards)).toHaveLength(4);
  });

  it('is not counted (the Coach counts face-up cards) though it has left the shoe', () => {
    const anim = (faceDown: 'banker' | null): AnimState => ({
      ...initialAnimState(),
      phase: 'dealing',
      hand: { ...onFelt, reveal: 'banker', faceDown },
      held: prev,
      current: { result, settlement, newShoe: null },
      running: true,
    });
    const waiting = deriveView(anim('banker'), live);
    expect(waiting.seenCards).toEqual([...prev.seenCards, ...cardsOnFelt(onFelt).slice(0, 5)]);
    expect(waiting.shoe.cardsRemaining).toBe(prev.shoe.cardsRemaining - 6);
    const turned = deriveView(anim(null), live);
    expect(turned.seenCards).toEqual([...prev.seenCards, ...cardsOnFelt(onFelt)]);
    expect(turned.shoe.cardsRemaining).toBe(prev.shoe.cardsRemaining - 6);
  });
});
