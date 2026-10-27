import { beforeEach, describe, expect, it } from 'vitest';
import { GameSession } from '@/engine';
import { clearHistory, getHistory, historyExtremes, recordHand, syncHistory } from './historyStore';

beforeEach(() => clearHistory());

describe('historyStore', () => {
  it('records settled hands newest first and tracks the extremes', () => {
    const session = new GameSession({ bankroll: 1000, seed: 11 });
    const nets: number[] = [];
    for (let i = 0; i < 5; i++) {
      session.placeBet('banker', 25);
      session.placeBet('tie', 5);
      const { result, settlement } = session.deal();
      nets.push(settlement.net);
      recordHand(result, settlement, session.getState().totalHands, session.getState().seed);
    }
    const entries = getHistory();
    expect(entries).toHaveLength(5);
    expect(entries.map((e) => e.sessionHand)).toEqual([5, 4, 3, 2, 1]);
    expect(entries[0].settlement!.net).toBe(nets[4]);
    expect(historyExtremes(entries)).toEqual({ biggestWin: Math.max(0, ...nets), biggestLoss: Math.min(0, ...nets) });
    // Syncing with the same session is a no-op.
    syncHistory(session.getState());
    expect(getHistory()).toHaveLength(5);
  });

  it('seeds hands dealt while the view was away (net only for the last one) and resets with the session', () => {
    const session = new GameSession({ bankroll: 1000, seed: 3 });
    session.placeBet('player', 10);
    session.deal();
    session.placeBet('player', 10);
    session.deal();
    syncHistory(session.getState());
    const entries = getHistory();
    expect(entries).toHaveLength(2);
    expect(entries[0].sessionHand).toBe(2);
    expect(entries[0].settlement).not.toBeNull();
    expect(entries[1].settlement).toBeNull();

    session.reset({ bankroll: 500, seed: 4 });
    syncHistory(session.getState());
    expect(getHistory()).toHaveLength(0);
  });
});
