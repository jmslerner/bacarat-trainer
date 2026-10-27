// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Histogram } from './Histogram';
import { CurvesChart } from './CurvesChart';
import { niceTicks, scaleLinear } from './scale';

afterEach(cleanup);

const bins = [
  { binStart: 400, binEnd: 600, count: 5 },
  { binStart: 600, binEnd: 800, count: 0 },
  { binStart: 800, binEnd: 1000, count: 40 },
  { binStart: 1000, binEnd: 1200, count: 30 },
  { binStart: 900, binEnd: 1100, count: 1 },
];

describe('scale helpers', () => {
  it('niceTicks covers the domain with round steps', () => {
    const t = niceTicks(0, 37, 4);
    expect(t.ticks).toEqual([0, 10, 20, 30, 40]);
    expect(t.min).toBe(0);
    expect(t.max).toBe(40);
    const money = niceTicks(480, 1320, 5);
    expect(money.ticks[0]).toBeLessThanOrEqual(480);
    expect(money.ticks[money.ticks.length - 1]).toBeGreaterThanOrEqual(1320);
    expect(niceTicks(5, 5, 4).ticks.length).toBeGreaterThan(1);
    expect(niceTicks(Number.NaN, Number.NaN).ticks).toEqual([0, 1]);
  });

  it('scaleLinear maps and tolerates an empty domain', () => {
    expect(scaleLinear(0, 10, 0, 100)(2.5)).toBe(25);
    expect(scaleLinear(5, 5, 0, 100)(5)).toBe(0);
  });
});

describe('Histogram', () => {
  it('draws one bar per non-empty bin, coloured by side of the start, with an accessible summary and a table', () => {
    render(<Histogram bins={bins.slice(0, 4)} start={1000} trials={75} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', expect.stringMatching(/75 trials in 4 bins from \$400 to \$1,200; 60% finished below the \$1,000 start/));
    const bars = svg.querySelectorAll('path[data-bin]');
    expect(bars).toHaveLength(3); // the empty bin draws nothing
    expect(bars[0].getAttribute('class')).toMatch(/barBelow/);
    expect(bars[2].getAttribute('class')).toMatch(/barAbove/);
    expect(bars[2].getAttribute('data-count')).toBe('30');
    expect(bars[2].querySelector('title')?.textContent).toBe('$1,000 to $1,200: 30 trials (40.0%)');
    expect(screen.getByText('Start $1,000')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Final bankroll distribution' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('$600 to $800').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent(/Finished below the start/);
  });

  it('marks a bin that straddles the start and copes with a single-value distribution', () => {
    const { unmount } = render(<Histogram bins={bins} start={1000} trials={76} />);
    const straddle = document.querySelector('path[data-bin="4"]');
    expect(straddle?.getAttribute('class')).toMatch(/barAcross/);
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent(/Straddles the start/);
    unmount();
    render(<Histogram bins={[{ binStart: 1000, binEnd: 1000, count: 12 }]} start={1000} trials={12} />);
    expect(document.querySelectorAll('path[data-bin]')).toHaveLength(1);
    expect(screen.getByRole('table').textContent).toMatch(/\$1,000/);
  });

  it('renders an empty state without bins', () => {
    render(<Histogram bins={[]} start={1000} trials={0} />);
    expect(screen.getByText('No trials to show.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('CurvesChart', () => {
  const curves = [
    [1000, 1010, 990, 1020, 1040],
    [1000, 990, 970, 950, 900],
    [1000, 1000, 1000, 1000, 1000],
  ];

  it('draws one line per trial, coloured by where it finished, with the start line and a table', () => {
    render(<CurvesChart curves={curves} curveHands={800} start={1000} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', expect.stringMatching(/3 sample trials over 800 hands, starting at \$1,000; 1 finished above the start and 2 at or below it/));
    const lines = svg.querySelectorAll('path[data-curve]');
    expect(lines).toHaveLength(3);
    expect(lines[0].getAttribute('data-side')).toBe('above');
    expect(lines[1].getAttribute('data-side')).toBe('below');
    expect(lines[2].getAttribute('data-side')).toBe('flat');
    expect(screen.getByText('Start $1,000')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[2]).toHaveTextContent('Trial 2$900$900$1,000');
    expect(svg.querySelector('[data-crosshair]')).toBeNull();
  });

  it('reads the bankrolls at a hand from the keyboard and clears on Escape', () => {
    render(<CurvesChart curves={curves} curveHands={800} start={1000} />);
    const group = screen.getByRole('group', { name: /Bankroll curves/ });
    fireEvent.keyDown(group, { key: 'End' });
    expect(screen.getByTestId('lab-curves-readout')).toHaveTextContent('Hand 800: highest $1,040, median $1,000, lowest $900; 1 of 3 ahead.');
    expect(document.querySelectorAll('[data-crosshair] circle')).toHaveLength(3);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getByTestId('lab-curves-readout')).toHaveTextContent('Hand 600');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(screen.getByTestId('lab-curves-readout')).toHaveTextContent('Hand 0: highest $1,000, median $1,000, lowest $1,000; 0 of 3 ahead.');
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(screen.getByTestId('lab-curves-readout')).toHaveTextContent('');
    expect(document.querySelector('[data-crosshair]')).toBeNull();
  });

  it('renders an empty state without curves', () => {
    render(<CurvesChart curves={[]} curveHands={0} start={1000} />);
    expect(screen.getByText('No sample curves to show.')).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });
});
