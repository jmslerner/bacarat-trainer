import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyCompact, formatOdds, formatPercent, formatSigned, formatNumber } from './format';

describe('format', () => {
  it('formats money', () => {
    expect(formatMoney(1000)).toBe('$1,000');
    expect(formatMoney(12.5)).toBe('$12.50');
    expect(formatMoney(-25)).toBe('-$25');
    expect(formatMoney(40, { signed: true })).toBe('+$40');
    expect(formatMoney(0, { signed: true })).toBe('$0');
    expect(formatMoney(0.004)).toBe('$0.00');
    expect(formatMoney(NaN)).toBe('—');
    expect(formatMoney(5, { cents: true })).toBe('$5.00');
  });
  it('formats compact money', () => {
    expect(formatMoneyCompact(750)).toBe('$750');
    expect(formatMoneyCompact(2500)).toBe('$2.5K');
    expect(formatMoneyCompact(12000)).toBe('$12K');
    expect(formatMoneyCompact(1_250_000)).toBe('$1.25M');
    expect(formatMoneyCompact(-1000)).toBe('-$1K');
  });
  it('formats percentages, signed numbers and odds', () => {
    expect(formatPercent(0.010183)).toBe('1.02%');
    expect(formatPercent(0.5, 0)).toBe('50%');
    expect(formatPercent(0.03, 1, true)).toBe('+3.0%');
    expect(formatSigned(3)).toBe('+3');
    expect(formatSigned(-2.5, 1)).toBe('-2.5');
    expect(formatOdds(40)).toBe('40:1');
    expect(formatOdds(0.5)).toBe('0.5:1');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
