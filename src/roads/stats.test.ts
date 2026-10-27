import { describe, expect, it } from 'vitest';
import { roadStats } from './stats';
import { seq } from './testHelpers';

describe('roadStats', () => {
  it('describes an empty shoe', () => {
    expect(roadStats([])).toEqual({
      total: 0,
      player: 0,
      banker: 0,
      tie: 0,
      playerPair: 0,
      bankerPair: 0,
      dragon7: 0,
      panda8: 0,
      currentStreak: { outcome: null, length: 0 },
      longestPlayer: 0,
      longestBanker: 0,
    });
  });

  it('counts outcomes, pairs and bonuses', () => {
    const stats = roadStats([
      { outcome: 'player', playerPair: true, panda8: true },
      { outcome: 'banker', bankerPair: true, dragon7: true },
      { outcome: 'banker', playerPair: true, bankerPair: true },
      { outcome: 'tie' },
    ]);
    expect(stats).toMatchObject({
      total: 4,
      player: 1,
      banker: 2,
      tie: 1,
      playerPair: 2,
      bankerPair: 2,
      dragon7: 1,
      panda8: 1,
    });
  });

  it('uses the big-road convention: ties do not break a streak', () => {
    // P P B T B B P → Banker streak of 3 (the tie is a mark), then Player 1
    const stats = roadStats(seq('P P B T B B P'));
    expect(stats.currentStreak).toEqual({ outcome: 'player', length: 1 });
    expect(stats.longestPlayer).toBe(2);
    expect(stats.longestBanker).toBe(3);

    const mid = roadStats(seq('P P B T B B T'));
    expect(mid.currentStreak).toEqual({ outcome: 'banker', length: 3 });
  });

  it('reports a tie streak only before the first Player/Banker result', () => {
    expect(roadStats(seq('T T')).currentStreak).toEqual({ outcome: 'tie', length: 2 });
    expect(roadStats(seq('T T B')).currentStreak).toEqual({ outcome: 'banker', length: 1 });
  });
});
