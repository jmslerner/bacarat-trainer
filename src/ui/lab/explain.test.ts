import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/engine';
import { expectedEdge } from './edge';
import { explainExpectedEdge, explainMeanFinal, explainMedianFinal, explainOutcomeMix, explainPProfit, explainPRuin, explainRealizedEdge, explainSideBet, explainWagered, verdictSentence } from './explain';
import { fakeResult } from './testHelpers';

describe('explanations', () => {
  it('say what the mean and median mean for the player', () => {
    expect(explainMeanFinal(fakeResult({ meanFinal: 917 }))).toBe('On average a session ended $83 down on the $1,000 it started with.');
    expect(explainMeanFinal(fakeResult({ meanFinal: 1040.5 }))).toBe('On average a session ended $40.50 ahead of the $1,000 it started with.');
    expect(explainMeanFinal(fakeResult({ meanFinal: 1000 }))).toMatch(/exactly where it started/);
    expect(explainMedianFinal(fakeResult({ meanFinal: 917, medianFinal: 925 }))).toBe('Half of the sessions finished below $925 and half above it.');
    expect(explainMedianFinal(fakeResult({ meanFinal: 1100, medianFinal: 925 }))).toMatch(/big wins pull the average above/);
    expect(explainMedianFinal(fakeResult({ meanFinal: 800, medianFinal: 925 }))).toMatch(/busts pull the average below/);
  });

  it('turn probabilities into sessions out of a hundred', () => {
    expect(explainPProfit(fakeResult({ pProfit: 0.38 }))).toBe('38 in 100 sessions like this end with more money than they started with.');
    expect(explainPProfit(fakeResult({ pProfit: 0 }))).toMatch(/Not one session/);
    expect(explainPRuin(fakeResult({ pRuin: 0.02 }))).toBe('2.0% of sessions ran out of money before the last shoe.');
    expect(explainPRuin(fakeResult({ pRuin: 0 }, { stopLoss: 200 }))).toBe('No session ran out of money or hit the stop loss before the last shoe.');
  });

  it('explain the realized edge as dollars per $100 wagered', () => {
    expect(explainRealizedEdge(fakeResult({ realizedEdge: 0.0102 }))).toBe('The house kept $1.02 of every $100 wagered across all sessions.');
    expect(explainRealizedEdge(fakeResult({ realizedEdge: -0.004 }))).toMatch(/The player kept \$0.40 of every \$100 wagered/);
    expect(explainRealizedEdge(fakeResult({ totalWagered: 0 }))).toMatch(/Nothing was wagered/);
    expect(explainWagered(fakeResult({ net: -8300 }))).toMatch(/house collected \$8,300/);
  });

  it('compare the run with the exact edge in words', () => {
    const inLine = fakeResult({ realizedEdge: 0.0105 });
    expect(explainExpectedEdge(inLine, expectedEdge(inLine))).toMatch(/landed on the exact figure/);
    const lucky = fakeResult({ realizedEdge: -0.01 });
    expect(explainExpectedEdge(lucky, expectedEdge(lucky))).toMatch(/Luckier than the math/);
    const unlucky = fakeResult({ realizedEdge: 0.03 });
    expect(explainExpectedEdge(unlucky, expectedEdge(unlucky))).toMatch(/Unluckier than the math/);
    expect(explainExpectedEdge(fakeResult({ totalWagered: 0 }), null)).toMatch(/nothing to price/);
  });

  it('describe the side bets and the outcome mix against the exact probabilities', () => {
    expect(explainSideBet('dragon7', { bets: 0, wins: 0, wagered: 0, net: 0 }, 'never', DEFAULT_RULES)).toBe('No Dragon 7 bets were placed.');
    const counted = explainSideBet('dragon7', { bets: 1000, wins: 30, wagered: 50_000, net: 11_500 }, 'count', DEFAULT_RULES);
    expect(counted).toMatch(/Betting only when the count said so, the Dragon 7 hit 3.00% of the time against 2.25% on a random hand: that is the counting edge at work; it made \$23 per \$100 wagered\./);
    const always = explainSideBet('panda8', { bets: 1000, wins: 30, wagered: 10_000, net: -2_200 }, 'always', DEFAULT_RULES);
    expect(always).toMatch(/Betting every hand, the Panda 8 hit 3.00% of the time \(math 3.45%\) and cost \$22 per \$100 wagered\./);
    expect(explainOutcomeMix(fakeResult(), DEFAULT_RULES)).toMatch(/^Banker won 45.9% of hands \(math 45.9%\), Player 44.6% \(44.6%\), Tie 9.5% \(9.5%\)/);
  });

  it('sums a run up in two sentences', () => {
    const r = fakeResult();
    const text = verdictSentence(r, expectedEdge(r));
    expect(text).toBe('Over 100 sessions of 10 shoes, Always Banker with Flat betting lost $83 on average. The house kept 1.02% of every dollar wagered (the math says 1.02%); 38% of sessions ended ahead and 2% went bust.');
  });
});
