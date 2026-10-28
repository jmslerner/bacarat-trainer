import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_PRESETS, dealFromValues } from '@/engine';
import { explainSteps } from './tips';

function tipsByType(player: Array<number | 'T' | 'J' | 'Q' | 'K' | 'A'>, banker: Array<number | 'T' | 'J' | 'Q' | 'K' | 'A'>, rules = DEFAULT_RULES) {
  const result = dealFromValues(player, banker, rules);
  const tips = explainSteps(result, rules);
  expect(tips).toHaveLength(result.steps.length);
  return result.steps.map((s, i) => ({ step: s, tip: tips[i] }));
}

describe('explainSteps', () => {
  it('explains a Player draw, the Banker table and a Panda 8', () => {
    // Player 5+0 draws 3 → 8 (Panda 8); Banker 3+0 draws against a 3 → 7 → 0.
    const rows = tipsByType([5, 0, 3], [3, 0, 7]);
    const text = (type: string, side?: string) => rows.find((r) => r.step.type === type && (side === undefined || ('side' in r.step && r.step.side === side)))!.tip;
    expect(rows[0].tip).toMatch(/Cards go Player, Banker, Player, Banker/);
    expect(rows[2].tip).toMatch(/^Player holds 5♠ 10♦: 5 counts 5, 10 counts 0, total 5\./);
    expect(text('show')).toMatch(/natural/);
    expect(text('draw', 'player')).toBe('Player has 5: with 0–5 the Player must draw a third card.');
    const p3 = rows.find((r) => r.step.type === 'deal' && r.step.index === 2 && r.step.to === 'player')!.tip;
    expect(p3).toMatch(/Player’s third card is 3. \(3 counts 3\): 5 \+ 3 → 8/);
    expect(text('draw', 'banker')).toBe('Banker has 3 and the Player’s third card was a 3: on 3 Banker draws unless the Player’s third card is an 8, so Banker draws.');
    expect(text('result')).toBe('Player 8 beats Banker 0. Player bets pay 1:1; Banker bets lose.');
    expect(text('bonus')).toMatch(/THREE-card 8 — the Panda 8, paying 25:1/);
  });

  it('explains the Banker standing against the Player’s third card and the Dragon 7', () => {
    // Player 2+2=4 draws a 9 → 3; Banker 6+0 → P3 is 9 → stands on 6. Banker 6 beats 3 (not a Dragon 7: two cards).
    const rows = tipsByType([2, 2, 9], [6, 0]);
    const standBanker = rows.find((r) => r.step.type === 'stand')!.tip;
    expect(standBanker).toBe('Banker has 6 and the Player’s third card was a 9: on 6 Banker draws only against a 6 or 7, so Banker stands.');
    expect(rows.find((r) => r.step.type === 'result')!.tip).toBe('Banker 6 beats Player 3. Banker bets pay 1:1 with no commission; Player bets lose.');

    // Dragon 7: Player 6 stands; Banker 3+0 draws (Player stood) a 4 → 7, three-card 7 wins.
    const d7 = tipsByType([6, 0], [3, 0, 4]);
    expect(d7.find((r) => r.step.type === 'stand')!.tip).toBe('Player has 6: with 6 or 7 the Player stands.');
    expect(d7.find((r) => r.step.type === 'draw')!.tip).toBe('The Player stood, so Banker follows the Player rule: 3 is 0–5, so Banker draws.');
    expect(d7.find((r) => r.step.type === 'bonus')!.tip).toMatch(/Dragon 7\. Dragon 7 bets pay 40:1 and the Banker bet is a push/);
    // An EZ table with the Dragon 7 bet switched off still calls the Dragon 7 (the Banker push) but has no bet to pay.
    const noSide = { ...DEFAULT_RULES, sideBets: { ...DEFAULT_RULES.sideBets, dragon7: false } };
    const d7Off = tipsByType([6, 0], [3, 0, 4], noSide).find((r) => r.step.type === 'bonus')!.tip;
    expect(d7Off).toBe('Banker won with a THREE-card 7 — the Dragon 7. The Banker bet is a push: that push is how EZ Baccarat replaces the commission.');
  });

  it('explains naturals, ties, pairs and the cut card, and adapts to the commission rule', () => {
    const nat = tipsByType([9, 0], [4, 3]);
    expect(nat.find((r) => r.step.type === 'natural')!.tip).toBe('Player’s two-card 9 is a natural: both hands stand and the hand is over.');
    const bankerNat = tipsByType([4, 3], [9, 0]);
    expect(bankerNat.find((r) => r.step.type === 'natural')!.tip).toBe('Banker’s two-card 9 is a natural: the Player never draws against a natural, so the hand is over.');

    // 4+4 is a natural 8 AND a pair.
    const both = tipsByType([9, 0], [4, 4]);
    expect(both.find((r) => r.step.type === 'natural')!.tip).toMatch(/Both hands are naturals/);
    expect(both.find((r) => r.step.type === 'bonus')!.tip).toMatch(/Banker Pair pays 11:1/);

    const tie = tipsByType([4, 4], [8, 0]);
    expect(tie.find((r) => r.step.type === 'result')!.tip).toBe('Equal totals: a Tie. Player and Banker bets push (money back); Tie bets pay 8:1.');
    expect(tie[2].tip).toMatch(/4 \+ 4|total 8/);

    const classic = tipsByType([6, 0], [7, 0], RULE_PRESETS.commission.rules);
    expect(classic.find((r) => r.step.type === 'result')!.tip).toBe('Banker 7 beats Player 6. Banker bets pay 1:1 minus 5% commission; Player bets lose.');

    // Totals over 9 explain the modulo.
    const mod = tipsByType([7, 6], [9, 0]);
    expect(mod[2].tip).toBe('Player holds 7♠ 6♦: 7 counts 7, 6 counts 6, total 3 — 13 counts as 3, only the last digit matters.');

    const cut = dealFromValues([6, 0], [7, 0]);
    cut.steps.push({ type: 'cutCard', message: 'Cut card — one more hand, then a new shoe' });
    const tips = explainSteps(cut, DEFAULT_RULES);
    expect(tips[tips.length - 1]).toMatch(/one more hand is dealt, then the shoe is reshuffled/);
  });
});
