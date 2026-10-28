import { describe, expect, it } from 'vitest';
import { animReducer, initialAnimState } from './useTableAnimation';
import { emptyHand, type Celebration } from './types';

const celebration: Celebration = { id: 'dragon7-1', kind: 'dragon7', side: 'banker', pays: 40, won: 200, offered: true, hadBet: true, bankerPush: true, holdMs: 2600 };

describe('animReducer — the Dragon 7 / Panda 8 moment', () => {
  it('a frame shows the celebration, the next deal, a reset and a skip clear it, the end of the timeline keeps it', () => {
    let s = initialAnimState();
    expect(s.celebration).toBeNull();
    s = animReducer(s, { type: 'begin', held: null, current: null });
    s = animReducer(s, { type: 'frame', frame: { at: 0, hand: { ...emptyHand(), reveal: 'banker' } } });
    s = animReducer(s, { type: 'frame', frame: { at: 0, celebrate: celebration } });
    expect(s.celebration).toBe(celebration);
    // Frames that say nothing about it leave it alone; re-renders see the same object.
    s = animReducer(s, { type: 'frame', frame: { at: 0, bankroll: 1200 } });
    expect(s.celebration).toBe(celebration);
    // Instant speed: the timeline is over at once but the banner still shows itself.
    expect(animReducer(s, { type: 'done' }).celebration).toBe(celebration);
    // The next deal clears it before a card is dealt.
    expect(animReducer(s, { type: 'begin', held: null, current: null }).celebration).toBeNull();
    expect(animReducer(s, { type: 'frame', frame: { at: 0, celebrate: null } }).celebration).toBeNull();
    expect(animReducer(s, { type: 'reset', message: 'Place your bets' }).celebration).toBeNull();
    // A fast-forward drops the banner and turns the suspense card face up at once.
    const skipped = animReducer(s, { type: 'skip' });
    expect(skipped.celebration).toBeNull();
    expect(skipped.hand.reveal).toBeNull();
    expect(skipped.hand.playerCards).toBe(s.hand.playerCards);
    // Nothing to skip: the same state object, so no render.
    expect(animReducer(skipped, { type: 'skip' })).toBe(skipped);
  });
});
