import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine';
import { BET_SELECTORS, getSelector, lastDecisiveOutcome, sideColumnStats } from './selectors';
import { context, history } from './testHelpers';
import type { MainChoice } from './types';

const pick = (id: string, outcomes: string, extra = {}): MainChoice => {
  const selector = getSelector(id);
  if (!selector) throw new Error(`no selector ${id}`);
  return selector.select(context({ shoeHistory: history(outcomes), ...extra }));
};

describe('bet selectors', () => {
  it('exposes the SPEC list with unique ids, names and descriptions', () => {
    expect(BET_SELECTORS.map((s) => s.id)).toEqual(['alwaysBanker', 'alwaysPlayer', 'followLast', 'betAgainstLast', 'followAfterN', 'alternate', 'bigRoadTrend', 'random']);
    for (const s of BET_SELECTORS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(10);
    }
    expect(getSelector('nope')).toBeUndefined();
  });

  it('every selector returns a legal choice on an empty shoe', () => {
    for (const s of BET_SELECTORS) expect(['player', 'banker', 'skip']).toContain(s.select(context()));
  });

  it('alwaysBanker / alwaysPlayer ignore the history', () => {
    for (const h of ['', 'PPPP', 'BBBB', 'TTT']) {
      expect(pick('alwaysBanker', h)).toBe('banker');
      expect(pick('alwaysPlayer', h)).toBe('player');
    }
  });

  it('followLast follows the last decisive result, ignoring ties, Banker to start', () => {
    expect(pick('followLast', '')).toBe('banker');
    expect(pick('followLast', 'T')).toBe('banker');
    expect(pick('followLast', 'P')).toBe('player');
    expect(pick('followLast', 'PT')).toBe('player');
    expect(pick('followLast', 'PBTT')).toBe('banker');
    expect(pick('followLast', 'BBBP')).toBe('player');
  });

  it('betAgainstLast chops against the last decisive result', () => {
    expect(pick('betAgainstLast', '')).toBe('banker');
    expect(pick('betAgainstLast', 'P')).toBe('banker');
    expect(pick('betAgainstLast', 'B')).toBe('player');
    expect(pick('betAgainstLast', 'BT')).toBe('player');
    expect(pick('betAgainstLast', 'PPB')).toBe('player');
  });

  it('followAfterN sits out until a streak of three, then rides it (ties do not break the streak)', () => {
    expect(pick('followAfterN', '')).toBe('skip');
    expect(pick('followAfterN', 'BB')).toBe('skip');
    expect(pick('followAfterN', 'BBB')).toBe('banker');
    expect(pick('followAfterN', 'BBTB')).toBe('banker');
    expect(pick('followAfterN', 'PPPPP')).toBe('player');
    expect(pick('followAfterN', 'PPPB')).toBe('skip');
    expect(pick('followAfterN', 'TTTT')).toBe('skip');
  });

  it('alternate goes Banker, Player, Banker… by hand number', () => {
    expect(pick('alternate', '', { handsPlayed: 0 })).toBe('banker');
    expect(pick('alternate', '', { handsPlayed: 1 })).toBe('player');
    expect(pick('alternate', '', { handsPlayed: 2 })).toBe('banker');
    expect(pick('alternate', '', { handsPlayed: 7 })).toBe('player');
  });

  it('bigRoadTrend bets the side with the longer average column', () => {
    // Banker columns 3 and 2 (avg 2.5) vs one Player column of 1.
    expect(pick('bigRoadTrend', 'BBBPBB')).toBe('banker');
    // Player columns 3 and 3 (avg 3) vs Banker columns of 1.
    expect(pick('bigRoadTrend', 'PPPBPPPB')).toBe('player');
    // Ties are ignored: P T P P is one Player column of 3.
    expect(pick('bigRoadTrend', 'PTPPB')).toBe('player');
    expect(pick('bigRoadTrend', '')).toBe('banker');
    expect(pick('bigRoadTrend', 'PB')).toBe('banker'); // level → Banker
  });

  it('random is reproducible from the context RNG and still deterministic without one', () => {
    const a = Array.from({ length: 20 }, () => pick('random', 'PB', { rng: createRng(7) }));
    const b = Array.from({ length: 20 }, () => pick('random', 'PB', { rng: createRng(7) }));
    expect(a).toEqual(b);
    const rng = createRng(3);
    const seq = Array.from({ length: 200 }, () => pick('random', 'PB', { rng }));
    expect(seq).toContain('player');
    expect(seq).toContain('banker');
    expect(pick('random', '')).toBe('banker');
    expect(pick('random', 'PBP', { handsPlayed: 3 })).toBe(pick('random', 'PBP', { handsPlayed: 3 }));
  });

  it('lastDecisiveOutcome and sideColumnStats', () => {
    expect(lastDecisiveOutcome(history(''))).toBeNull();
    expect(lastDecisiveOutcome(history('TT'))).toBeNull();
    expect(lastDecisiveOutcome(history('PBT'))).toBe('banker');
    // B B T B | P P | B T T B → Banker columns of 3 and 2 (ties never break a column), one Player column of 2.
    const stats = sideColumnStats(history('BBTBPPBTTB'));
    expect(stats.cells).toEqual({ player: 2, banker: 5 });
    expect(stats.columns).toEqual({ player: 1, banker: 2 });
    expect(stats.averageColumn.banker).toBe(2.5);
    expect(stats.averageColumn.player).toBe(2);
    expect(sideColumnStats(history('BPBPB')).columns).toEqual({ player: 2, banker: 3 });
    expect(sideColumnStats([]).averageColumn).toEqual({ player: 0, banker: 0 });
  });
});
