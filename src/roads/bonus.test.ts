import { describe, expect, it } from 'vitest';
import { EXACT_8_DECKS } from '@/engine';
import {
  BONUS_EXPECTED_EVERY,
  bonusCountTitle,
  bonusHistory,
  bonusHitLabel,
  bonusHitTitle,
  bonusOf,
  bonusSinceText,
  handsAgoText,
} from './bonus';
import { roadStats } from './stats';
import { mulberry32, randomResults, seq } from './testHelpers';
import type { RoadResult } from './types';

const D7: RoadResult = { outcome: 'banker', dragon7: true };
const P8: RoadResult = { outcome: 'player', panda8: true };

describe('bonusHistory', () => {
  it('expects a Dragon 7 about once in 44 hands and a Panda 8 about once in 29 (the exact 8-deck figures)', () => {
    expect(BONUS_EXPECTED_EVERY).toEqual({ dragon7: 44, panda8: 29 });
    expect(Math.round(1 / EXACT_8_DECKS.dragon7)).toBe(44);
    expect(Math.round(1 / EXACT_8_DECKS.panda8)).toBe(29);
  });

  it('describes an empty shoe', () => {
    expect(bonusHistory([])).toEqual({
      total: 0,
      hits: [],
      latest: null,
      dragon7: { kind: 'dragon7', count: 0, last: null, handsSince: 0, expectedEvery: 44, latest: false },
      panda8: { kind: 'panda8', count: 0, last: null, handsSince: 0, expectedEvery: 29, latest: false },
    });
  });

  it('counts every hand as "since" while nothing has hit', () => {
    const h = bonusHistory(seq('P B T B B P'));
    expect(h.hits).toEqual([]);
    expect(h.latest).toBeNull();
    expect(h.dragon7).toMatchObject({ count: 0, last: null, handsSince: 6, latest: false });
    expect(h.panda8).toMatchObject({ count: 0, last: null, handsSince: 6, latest: false });
  });

  it('lists several hits in hand order with 1-based hand numbers, ties interleaved', () => {
    // hands: 1 P, 2 T, 3 B (D7), 4 T, 5 P (P8), 6 B, 7 T, 8 B (D7), 9 T
    const results: RoadResult[] = [...seq('P T'), D7, ...seq('T'), P8, ...seq('B T'), D7, ...seq('T')];
    const h = bonusHistory(results);
    expect(h.total).toBe(9);
    expect(h.hits).toEqual([
      { kind: 'dragon7', handIndex: 2, hand: 3 },
      { kind: 'panda8', handIndex: 4, hand: 5 },
      { kind: 'dragon7', handIndex: 7, hand: 8 },
    ]);
    expect(h.dragon7).toMatchObject({ count: 2, last: { hand: 8, handIndex: 7 }, handsSince: 1, latest: false });
    expect(h.panda8).toMatchObject({ count: 1, last: { hand: 5, handIndex: 4 }, handsSince: 4, latest: false });
    expect(h.latest).toBeNull(); // the newest hand is a tie
  });

  it('flags the newest hand when it is a hit', () => {
    const p = bonusHistory([...seq('B B P'), P8]);
    expect(p.latest).toBe('panda8');
    expect(p.panda8).toMatchObject({ count: 1, handsSince: 0, latest: true, last: { hand: 4, handIndex: 3 } });
    expect(p.dragon7).toMatchObject({ count: 0, handsSince: 4, latest: false });

    const d = bonusHistory([...seq('B B P'), D7]);
    expect(d.latest).toBe('dragon7');
    expect(d.dragon7.latest).toBe(true);
    expect(d.panda8.latest).toBe(false);

    // two hits in a row: both listed, only the newest is "latest"
    const twice = bonusHistory([D7, D7]);
    expect(twice.hits.map((hit) => hit.hand)).toEqual([1, 2]);
    expect(twice.dragon7).toMatchObject({ count: 2, handsSince: 0, latest: true, last: { hand: 2 } });
  });

  it('ignores flags that are false or missing and never mutates its input', () => {
    const results: RoadResult[] = [{ outcome: 'banker', dragon7: false, panda8: false }, { outcome: 'player' }];
    const copy = structuredClone(results);
    expect(bonusHistory(results).hits).toEqual([]);
    expect(results).toEqual(copy);
  });

  it('treats a result flagged with both bonuses as a Dragon 7 (a hand cannot be both)', () => {
    expect(bonusOf({ outcome: 'banker', dragon7: true, panda8: true })).toBe('dragon7');
    expect(bonusOf({ outcome: 'player', panda8: true })).toBe('panda8');
    expect(bonusOf({ outcome: 'tie' })).toBeNull();
    expect(bonusOf(undefined)).toBeNull();
    expect(bonusHistory([{ outcome: 'banker', dragon7: true, panda8: true }]).hits).toEqual([
      { kind: 'dragon7', handIndex: 0, hand: 1 },
    ]);
  });

  it('agrees with roadStats on random shoes', () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 20; i += 1) {
      const results = randomResults(rng, 80);
      const h = bonusHistory(results);
      const stats = roadStats(results);
      expect(h.dragon7.count).toBe(stats.dragon7);
      expect(h.panda8.count).toBe(stats.panda8);
      expect(h.hits).toHaveLength(stats.dragon7 + stats.panda8);
      for (let k = 1; k < h.hits.length; k += 1) expect(h.hits[k].handIndex).toBeGreaterThan(h.hits[k - 1].handIndex);
      const last = results.at(-1);
      expect(h.latest).toBe(last?.dragon7 === true ? 'dragon7' : last?.panda8 === true ? 'panda8' : null);
    }
  });
});

describe('bonus text', () => {
  it('names a hit cell and its tooltip', () => {
    expect(bonusHitLabel('dragon7', 12)).toBe('Hand 12: Banker, Dragon 7');
    expect(bonusHitLabel('panda8', 27)).toBe('Hand 27: Player, Panda 8');
    expect(bonusHitTitle('dragon7', 12)).toBe('Dragon 7 on hand 12 — Banker wins with a three-card 7');
    expect(bonusHitTitle('panda8', 27)).toBe('Panda 8 on hand 27 — Player wins with a three-card 8');
  });

  it('says how long ago', () => {
    expect(handsAgoText(0)).toBe('this hand');
    expect(handsAgoText(1)).toBe('1 hand ago');
    expect(handsAgoText(58)).toBe('58 hands ago');
  });

  it('writes the "since" line for a hit, for the newest hand and for no hit', () => {
    const results = [...seq('B'.repeat(11)), D7, ...seq('P'.repeat(23))]; // D7 on hand 12, 35 hands
    const h = bonusHistory(results);
    expect(bonusSinceText(h.dragon7)).toBe('Since last Dragon 7: 23 hands (expected about 1 in 44)');
    expect(bonusSinceText(h.panda8)).toBe('No Panda 8 in 35 hands (expected about 1 in 29)');
    expect(bonusSinceText(bonusHistory([D7]).dragon7)).toBe('Since last Dragon 7: this hand (expected about 1 in 44)');
    expect(bonusSinceText(bonusHistory([D7, ...seq('P')]).dragon7)).toBe('Since last Dragon 7: 1 hand (expected about 1 in 44)');
    expect(bonusSinceText(bonusHistory(seq('P')).panda8)).toBe('No Panda 8 in 1 hand (expected about 1 in 29)');
    expect(bonusSinceText(bonusHistory([]).panda8)).toBe('No Panda 8 yet (expected about 1 in 29)');
  });

  it('writes the counter tooltip', () => {
    const results = [...seq('B'.repeat(22)), D7, ...seq('P'.repeat(58))]; // D7 on hand 23, 81 hands → 58 ago
    const h = bonusHistory(results);
    expect(bonusCountTitle(h.dragon7)).toBe('Dragon 7 × 1 · last D7: hand 23 · 58 hands ago · expected about 1 in 44 hands');
    expect(bonusCountTitle(h.panda8)).toBe('Panda 8 — none yet this shoe · expected about 1 in 29 hands');
    expect(bonusCountTitle(bonusHistory([P8]).panda8)).toBe('Panda 8 × 1 · last P8: hand 1 · this hand · expected about 1 in 29 hands');
  });
});
