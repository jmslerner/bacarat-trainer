import { describe, expect, it } from 'vitest';
import { describeStrategy } from './describe';

describe('describeStrategy', () => {
  it('reads as one sentence', () => {
    expect(describeStrategy({ selectorId: 'alwaysBanker', systemId: 'flat', unit: 10, sideBets: { dragon7: 'count', panda8: 'never', units: 1 } })).toBe(
      'Always Banker, Flat betting, $10 unit; Dragon 7 $10 at true count 4+; no Panda 8.',
    );
    expect(describeStrategy({ selectorId: 'followLast', systemId: 'martingale', systemParams: { maxDoublings: 5 }, unit: 25, sideBets: { dragon7: 'always', panda8: 'count', units: 2 } })).toBe(
      'Follow the streak, Martingale (max doublings 5), $25 unit; Dragon 7 $50 every hand; Panda 8 $50 at true count 8+.',
    );
    expect(describeStrategy({ selectorId: 'random', systemId: 'labouchere', unit: 5, sideBets: { dragon7: 'never', panda8: 'never', units: 1 } })).toBe(
      'Random, Labouchere (line length 4), $5 unit; no Dragon 7; no Panda 8.',
    );
  });

  it('treats zero side-bet units as never and names unknown ids', () => {
    expect(describeStrategy({ selectorId: 'alwaysPlayer', systemId: 'flat', unit: 10, sideBets: { dragon7: 'always', panda8: 'always', units: 0 } })).toContain('no Dragon 7; no Panda 8');
    const text = describeStrategy({ selectorId: 'x', systemId: 'y', unit: 10, sideBets: { dragon7: 'never', panda8: 'never', units: 1 } });
    expect(text).toContain('unknown selector "x"');
    expect(text).toContain('unknown system "y"');
  });
});
