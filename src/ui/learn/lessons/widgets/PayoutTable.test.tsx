// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, RULE_PRESETS } from '@/engine';
import { PayoutTable, payoutLabel } from './PayoutTable';

afterEach(cleanup);

function edge(bet: string): string {
  return document.querySelector(`[data-edge="${bet}"]`)?.textContent ?? '';
}

describe('PayoutTable', () => {
  it('shows the SPEC house edges for the default EZ table', () => {
    render(<PayoutTable rules={DEFAULT_RULES} />);
    expect(edge('banker')).toBe('1.02%');
    expect(edge('player')).toBe('1.24%');
    expect(edge('tie')).toBe('14.36%');
    expect(edge('dragon7')).toBe('7.61%');
    expect(edge('panda8')).toBe('10.19%');
    expect(edge('playerPair')).toBe('10.36%');
    expect(edge('bankerPair')).toBe('10.36%');
    expect(document.querySelector('[data-bet="banker"]')).toHaveTextContent('1:1, push on Dragon 7');
    expect(document.querySelector('[data-bet="banker"]')).toHaveTextContent('$1.02');
  });

  it('follows the Banker rule and marks bets the table does not deal', () => {
    render(<PayoutTable rules={RULE_PRESETS.commission.rules} />);
    expect(edge('banker')).toBe('1.06%');
    expect(document.querySelector('[data-bet="dragon7"]')).toHaveTextContent('not dealt here');
    cleanup();
    render(<PayoutTable rules={RULE_PRESETS.super6.rules} />);
    expect(edge('banker')).toBe('1.46%');
    expect(payoutLabel('banker', RULE_PRESETS.super6.rules)).toBe('1:1 (1:2 on a Banker 6)');
    expect(payoutLabel('tie', { ...DEFAULT_RULES, tiePays: 9 })).toBe('9:1');
  });
});
