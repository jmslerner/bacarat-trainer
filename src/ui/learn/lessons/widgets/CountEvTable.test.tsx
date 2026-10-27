// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CountEvTable, bucketLabel, pooledAbove } from './CountEvTable';

afterEach(cleanup);

const ROWS = [
  { tcMin: -Infinity, tcMax: -2, hands: 1000, frequency: 0.1, ev: -0.12 },
  { tcMin: -2, tcMax: 0, hands: 4000, frequency: 0.4, ev: -0.09 },
  { tcMin: 0, tcMax: 2, hands: 3000, frequency: 0.3, ev: -0.06 },
  { tcMin: 2, tcMax: 4, hands: 1500, frequency: 0.15, ev: -0.01 },
  { tcMin: 4, tcMax: 6, hands: 400, frequency: 0.04, ev: 0.05 },
  { tcMin: 6, tcMax: Infinity, hands: 100, frequency: 0.01, ev: 0.2 },
];

describe('CountEvTable', () => {
  it('labels buckets and pools the rows at or above the threshold', () => {
    expect(bucketLabel(ROWS[0])).toBe('below -2');
    expect(bucketLabel(ROWS[3])).toBe('+2 to +4');
    expect(bucketLabel(ROWS[5])).toBe('+6 and above');
    const pooled = pooledAbove(ROWS, 4);
    expect(pooled.hands).toBe(500);
    expect(pooled.frequency).toBeCloseTo(0.05, 12);
    expect(pooled.ev).toBeCloseTo((400 * 0.05 + 100 * 0.2) / 500, 12);
    expect(pooled.perHundredHands).toBeCloseTo(0.05 * pooled.ev * 100, 12);
  });

  it('renders the rows and the summary', () => {
    render(<CountEvTable name="Dragon 7" rows={ROWS} threshold={4} amount={500} />);
    expect(document.querySelectorAll('[data-bucket-bet="true"]')).toHaveLength(2);
    expect(document.querySelector('[data-count-ev="Dragon 7"]')).toHaveTextContent('Bet when TC ≥ +4');
    expect(document.querySelector('[data-count-ev="Dragon 7"]')).toHaveTextContent('5.0%');
  });

  it('copes with an empty table', () => {
    render(<CountEvTable name="Panda 8" rows={[]} threshold={8} amount={500} />);
    expect(document.body).toHaveTextContent('not available');
  });
});
