import { describe, expect, it } from 'vitest';
import { bankerDraws, playerDraws } from '@/engine';
import { bankerDrawValues, bankerRuleText, explainThirdCard } from './thirdCardLogic';

describe('explainThirdCard', () => {
  it('ends the hand on a natural', () => {
    const ex = explainThirdCard(8, 3);
    expect(ex.natural).toBe('player');
    expect(ex.playerAction).toBe('stands');
    expect(ex.bankerAction).toBe('stands');
    expect(ex.lines[0]).toMatch(/Player shows 8 — a natural/);
    expect(explainThirdCard(2, 9).natural).toBe('banker');
    expect(explainThirdCard(9, 8).natural).toBe('both');
    expect(explainThirdCard(9, 8).lines[0]).toMatch(/Player shows 9 and Banker shows 8/);
  });

  it('Player stands on 6–7 and the Banker then uses the simple rule', () => {
    const a = explainThirdCard(6, 5);
    expect(a.playerAction).toBe('stands');
    expect(a.bankerAction).toBe('draws');
    expect(a.needsPlayerThird).toBe(false);
    expect(a.lines[1]).toMatch(/Banker has 5 and draws \(0–5\)/);
    const b = explainThirdCard(7, 6);
    expect(b.bankerAction).toBe('stands');
    expect(b.lines[1]).toMatch(/stands \(6 or 7\)/);
  });

  it('waits for the Player third card when the Player draws', () => {
    const ex = explainThirdCard(5, 3);
    expect(ex.playerAction).toBe('draws');
    expect(ex.bankerAction).toBeNull();
    expect(ex.needsPlayerThird).toBe(true);
    expect(ex.bankerDrawsOn).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9]);
    expect(ex.lines.at(-1)).toMatch(/Pick the Player/);
  });

  it('explains the classic cases with the rule and the verdict', () => {
    const stands = explainThirdCard(5, 3, 8);
    expect(stands.bankerAction).toBe('stands');
    expect(stands.bankerRule).toBe('With 3, the Banker draws unless the Player’s third card is an 8.');
    expect(stands.lines.at(-1)).toMatch(/third card is a 8 \(Player now has 3\), so the Banker stands/);

    const draws = explainThirdCard(5, 3, 9);
    expect(draws.bankerAction).toBe('draws');
    expect(draws.lines.at(-1)).toMatch(/Player now has 4\), so the Banker draws/);

    expect(explainThirdCard(2, 6, 6).bankerAction).toBe('draws');
    expect(explainThirdCard(2, 6, 5).bankerAction).toBe('stands');
    expect(explainThirdCard(4, 7, 7).bankerAction).toBe('stands');
    expect(explainThirdCard(0, 2, 8).bankerAction).toBe('draws');
    expect(explainThirdCard(3, 4, 1).bankerAction).toBe('stands');
    expect(explainThirdCard(3, 4, 2).bankerAction).toBe('draws');
    expect(explainThirdCard(1, 5, 3).bankerAction).toBe('stands');
    expect(explainThirdCard(1, 5, 4).bankerAction).toBe('draws');
  });

  it('agrees with the engine for every two-card total and third card', () => {
    for (let pt = 0; pt <= 9; pt++) {
      for (let bt = 0; bt <= 9; bt++) {
        for (let p3 = 0; p3 <= 9; p3++) {
          const ex = explainThirdCard(pt, bt, p3);
          if (pt >= 8 || bt >= 8) {
            expect(ex.natural).not.toBeNull();
            expect(ex.bankerAction).toBe('stands');
            continue;
          }
          const playerDrew = playerDraws(pt);
          expect(ex.playerAction).toBe(playerDrew ? 'draws' : 'stands');
          const expected = bankerDraws(bt, playerDrew ? p3 : null) ? 'draws' : 'stands';
          expect(ex.bankerAction).toBe(expected);
        }
      }
    }
  });

  it('rejects totals outside 0–9', () => {
    expect(() => explainThirdCard(10, 1)).toThrow(RangeError);
    expect(() => explainThirdCard(1, -1)).toThrow(RangeError);
    expect(() => explainThirdCard(1, 1, 12)).toThrow(RangeError);
  });
});

describe('bankerDrawValues / bankerRuleText', () => {
  it('lists the SPEC table rows', () => {
    expect(bankerDrawValues(0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bankerDrawValues(2)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bankerDrawValues(3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9]);
    expect(bankerDrawValues(4)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(bankerDrawValues(5)).toEqual([4, 5, 6, 7]);
    expect(bankerDrawValues(6)).toEqual([6, 7]);
    expect(bankerDrawValues(7)).toEqual([]);
  });
  it('words each row', () => {
    expect(bankerRuleText(1)).toBe('With 1, the Banker always draws.');
    expect(bankerRuleText(7)).toBe('With 7, the Banker always stands.');
    expect(bankerRuleText(4)).toBe('With 4, the Banker draws when the Player’s third card is 2–7 and stands on 0, 1, 8 or 9.');
    expect(bankerRuleText(6)).toBe('With 6, the Banker draws when the Player’s third card is 6 or 7 and stands on 0–5, 8 or 9.');
  });
});
