import { describe, expect, it } from 'vitest';
import groundTruth from '../../docs/probabilities.json';
import { Shoe } from './shoe';
import { dealHand } from './deal';
import { createRng } from './rng';
import { cloneRules, DEFAULT_RULES } from './rules';
import { exactProbabilities } from './probabilities';
import type { TableRules } from './types';

interface Tally {
  hands: number;
  player: number;
  banker: number;
  tie: number;
  dragon7: number;
  panda8: number;
  pairs: number; // Player + Banker pairs (two samples per hand)
  bankerWin6: number;
  playerNaturals: number;
  bankerNaturals: number;
  cards4: number;
  cards5: number;
  cards6: number;
}

/** Deals `hands` hands through complete shoes with the real casino procedure (burn, cut card, one more hand, new shoe). */
function simulate(rules: TableRules, hands: number, seed: number): Tally {
  const t: Tally = { hands: 0, player: 0, banker: 0, tie: 0, dragon7: 0, panda8: 0, pairs: 0, bankerWin6: 0, playerNaturals: 0, bankerNaturals: 0, cards4: 0, cards5: 0, cards6: 0 };
  const rng = createRng(seed);
  let shoe = new Shoe(rules, rng, 1);
  let lastHandNext = false;
  let handNumber = 0;
  while (t.hands < hands) {
    handNumber++;
    const r = dealHand(shoe, rules, handNumber, { withSteps: false });
    t.hands++;
    if (r.outcome === 'player') t.player++;
    else if (r.outcome === 'banker') t.banker++;
    else t.tie++;
    if (r.dragon7) t.dragon7++;
    if (r.panda8) t.panda8++;
    if (r.playerPair) t.pairs++;
    if (r.bankerPair) t.pairs++;
    if (r.bankerWinOn6) t.bankerWin6++;
    if (r.playerNatural) t.playerNaturals++;
    if (r.bankerNatural) t.bankerNaturals++;
    const used = r.playerCards.length + r.bankerCards.length;
    if (used === 4) t.cards4++;
    else if (used === 5) t.cards5++;
    else t.cards6++;

    if (lastHandNext || shoe.cardsRemaining() < 6) {
      shoe = new Shoe(rules, rng, shoe.shoeNumber + 1);
      lastHandNext = false;
      handNumber = 0;
    } else if (r.cutCardDrawn) {
      lastHandNext = true;
    }
  }
  return t;
}

describe('Monte Carlo verification against the exact probabilities (SPEC §3)', () => {
  it('8 decks, 2,000,000 hands: P/B/T within 0.1%, Dragon 7 / Panda 8 / pair within 0.05%', () => {
    const N = 2_000_000;
    const t = simulate(DEFAULT_RULES, N, 20261026);
    const p = exactProbabilities(8);
    expect(t.hands).toBe(N);

    // The ground truth is docs/probabilities.json itself (SPEC §3), not just the constants copied from it.
    const json = groundTruth.decks_8;
    expect(Math.abs(t.player / N - json.player)).toBeLessThan(0.001);
    expect(Math.abs(t.banker / N - json.banker)).toBeLessThan(0.001);
    expect(Math.abs(t.tie / N - json.tie)).toBeLessThan(0.001);
    expect(Math.abs(t.dragon7 / N - json.dragon7)).toBeLessThan(0.0005);
    expect(Math.abs(t.panda8 / N - json.panda8)).toBeLessThan(0.0005);
    expect(Math.abs(t.pairs / (2 * N) - json.pair_prob)).toBeLessThan(0.0005);

    expect(Math.abs(t.player / N - p.player)).toBeLessThan(0.001);
    expect(Math.abs(t.banker / N - p.banker)).toBeLessThan(0.001);
    expect(Math.abs(t.tie / N - p.tie)).toBeLessThan(0.001);
    expect(Math.abs(t.dragon7 / N - p.dragon7)).toBeLessThan(0.0005);
    expect(Math.abs(t.panda8 / N - p.panda8)).toBeLessThan(0.0005);
    expect(Math.abs(t.pairs / (2 * N) - p.pair)).toBeLessThan(0.0005);

    // Further checks of the dealing procedure (looser, still far tighter than any rule error would allow).
    expect(Math.abs(t.bankerWin6 / N - p.bankerWin6)).toBeLessThan(0.001);
    expect(Math.abs(t.playerNaturals / N - p.natural)).toBeLessThan(0.001);
    expect(Math.abs(t.bankerNaturals / N - p.natural)).toBeLessThan(0.001);
    expect(Math.abs(t.cards4 / N - p.cards4)).toBeLessThan(0.0015);
    expect(Math.abs(t.cards5 / N - p.cards5)).toBeLessThan(0.0015);
    expect(Math.abs(t.cards6 / N - p.cards6)).toBeLessThan(0.0015);
  });

  it('6 decks, 1,000,000 hands', () => {
    const N = 1_000_000;
    const rules: TableRules = { ...cloneRules(DEFAULT_RULES), decks: 6 };
    const t = simulate(rules, N, 6_060_606);
    const p = exactProbabilities(6);
    expect(p.player).toBe(groundTruth.decks_6.player);
    expect(p.dragon7).toBe(groundTruth.decks_6.dragon7);
    expect(p.panda8).toBe(groundTruth.decks_6.panda8);
    expect(p.pair).toBe(groundTruth.decks_6.pair_prob);
    expect(Math.abs(t.player / N - p.player)).toBeLessThan(0.0015);
    expect(Math.abs(t.banker / N - p.banker)).toBeLessThan(0.0015);
    expect(Math.abs(t.tie / N - p.tie)).toBeLessThan(0.0015);
    expect(Math.abs(t.dragon7 / N - p.dragon7)).toBeLessThan(0.0007);
    expect(Math.abs(t.panda8 / N - p.panda8)).toBeLessThan(0.0007);
    expect(Math.abs(t.pairs / (2 * N) - p.pair)).toBeLessThan(0.0007);
  });

  it('is deterministic for a seed', () => {
    const a = simulate(DEFAULT_RULES, 20_000, 99);
    const b = simulate(DEFAULT_RULES, 20_000, 99);
    expect(a).toEqual(b);
    expect(simulate(DEFAULT_RULES, 20_000, 100)).not.toEqual(a);
  });
});
