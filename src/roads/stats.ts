import type { Side, StreakInfo } from '@/engine';
import type { RoadResult, RoadStats } from './types';

/**
 * Counts for the scoreboard strip plus streak information using the big-road convention: ties never break a
 * Player/Banker streak (they are marks on the current cell), so `currentStreak` is the current big-road column
 * and `longestPlayer` / `longestBanker` are the longest columns of each side.
 */
export function roadStats(results: readonly RoadResult[]): RoadStats {
  let player = 0;
  let banker = 0;
  let tie = 0;
  let playerPair = 0;
  let bankerPair = 0;
  let dragon7 = 0;
  let panda8 = 0;
  let longestPlayer = 0;
  let longestBanker = 0;
  let streakSide: Side | null = null;
  let streakLength = 0;

  for (const result of results) {
    if (result.playerPair === true) playerPair += 1;
    if (result.bankerPair === true) bankerPair += 1;
    if (result.dragon7 === true) dragon7 += 1;
    if (result.panda8 === true) panda8 += 1;

    if (result.outcome === 'tie') {
      tie += 1;
      continue;
    }
    if (result.outcome === 'player') player += 1;
    else banker += 1;

    if (result.outcome === streakSide) {
      streakLength += 1;
    } else {
      streakSide = result.outcome;
      streakLength = 1;
    }
    if (streakSide === 'player') longestPlayer = Math.max(longestPlayer, streakLength);
    else longestBanker = Math.max(longestBanker, streakLength);
  }

  let currentStreak: StreakInfo;
  if (streakSide !== null) currentStreak = { outcome: streakSide, length: streakLength };
  else if (tie > 0) currentStreak = { outcome: 'tie', length: tie };
  else currentStreak = { outcome: null, length: 0 };

  return {
    total: results.length,
    player,
    banker,
    tie,
    playerPair,
    bankerPair,
    dragon7,
    panda8,
    currentStreak,
    longestPlayer,
    longestBanker,
  };
}
