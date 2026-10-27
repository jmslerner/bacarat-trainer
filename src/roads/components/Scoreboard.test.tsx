// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { seq } from '../testHelpers';
import { Scoreboard } from './Scoreboard';

let errorSpy: MockInstance;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

const results = [
  ...seq('B B P P B P P'),
  { outcome: 'player' as const, playerPair: true, panda8: true },
  { outcome: 'banker' as const, bankerPair: true, dragon7: true },
  { outcome: 'tie' as const },
];

describe('Scoreboard', () => {
  it('lays out the five roads with their captions', () => {
    const { getByRole } = render(<Scoreboard results={results} />);
    for (const label of ['Bead Plate', 'Big Road', 'Big Eye Boy', 'Small Road', 'Cockroach Pig']) {
      expect(getByRole('group', { name: label })).toBeTruthy();
    }
    expect(getByRole('region', { name: 'Scoreboard' })).toBeTruthy();
    expect(getByRole('img', { name: 'Bead plate: 10 hands' })).toBeTruthy();
    expect(getByRole('img', { name: 'Big road: 5 Player, 4 Banker, 1 Tie' })).toBeTruthy();
  });

  it('shows the counts strip', () => {
    const { getByRole, getByText } = render(<Scoreboard results={results} />);
    const counts = getByRole('list', { name: 'Shoe counts' });
    const labels = within(counts)
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Player: 5',
      'Banker: 4',
      'Tie: 1',
      'Player Pair: 1',
      'Banker Pair: 1',
      'Dragon 7: 1',
      'Panda 8: 1',
      'Current streak: Banker × 1',
    ]);
    expect(getByText('Hand 10')).toBeTruthy();
  });

  it('toggles an "Ask" prediction, highlights the roads and reports the colours', () => {
    const onPredict = vi.fn();
    const { container, getByRole } = render(<Scoreboard results={results} onPredict={onPredict} />);
    // B B P P B P P P B (+ tie): L = [2, 2, 1, 4, 1]
    // next Banker → cell (5,2): big eye column 4 L=4 >= 2 red; small column 3 L=1 === 1 blue;
    // cockroach column 2 L=2 >= 2 red.
    const askB = getByRole('button', { name: /^Ask Banker/ });
    expect(askB.getAttribute('aria-label')).toBe('Ask Banker: Big Eye Boy red, Small Road blue, Cockroach Pig red');
    expect(askB.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-ghost]')).toHaveLength(0);

    fireEvent.click(askB);
    expect(onPredict).toHaveBeenLastCalledWith('banker');
    expect(askB.getAttribute('aria-pressed')).toBe('true');
    // ghost on the big road + one per derived road that gets an entry
    expect(container.querySelectorAll('[data-road="big"] [data-ghost]')).toHaveLength(1);
    expect(container.querySelector('[data-road="bigEye"] [data-ghost]')?.getAttribute('data-color')).toBe('red');
    expect(container.querySelector('[data-road="small"] [data-ghost]')?.getAttribute('data-color')).toBe('blue');
    expect(container.querySelector('[data-road="cockroach"] [data-ghost]')?.getAttribute('data-color')).toBe('red');
    expect(container.querySelector('[data-ask-status]')?.textContent).toBe(
      'If Banker next: Big Eye Boy red, Small Road blue, Cockroach Pig red',
    );

    // switching to Player replaces the selection; clicking again clears it
    const askP = getByRole('button', { name: /^Ask Player/ });
    fireEvent.click(askP);
    expect(onPredict).toHaveBeenLastCalledWith('player');
    expect(askP.getAttribute('aria-pressed')).toBe('true');
    expect(askB.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(askP);
    expect(onPredict).toHaveBeenLastCalledWith(null);
    expect(askP.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-ghost]')).toHaveLength(0);
    expect(container.querySelector('[data-ask-status]')?.textContent).toBe('');
  });

  it('supports a controlled prediction', () => {
    const onPredict = vi.fn();
    const { container, getByRole, rerender } = render(
      <Scoreboard results={results} prediction="player" onPredict={onPredict} />,
    );
    const askP = getByRole('button', { name: /^Ask Player/ });
    expect(askP.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-road="big"] [data-ghost]')).toHaveLength(1);

    fireEvent.click(askP);
    expect(onPredict).toHaveBeenCalledWith(null);
    // still pressed: the parent owns the value
    expect(askP.getAttribute('aria-pressed')).toBe('true');

    rerender(<Scoreboard results={results} prediction={null} onPredict={onPredict} />);
    expect(askP.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-ghost]')).toHaveLength(0);
  });

  it('renders an empty shoe without entries or predictions', () => {
    const { container, getByRole } = render(<Scoreboard results={[]} />);
    expect(container.querySelectorAll('[data-bead]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-big-cell]')).toHaveLength(0);
    expect(getByRole('button', { name: /^Ask Player/ }).getAttribute('aria-label')).toBe(
      'Ask Player: Big Eye Boy no entry, Small Road no entry, Cockroach Pig no entry',
    );
    expect(getByRole('list', { name: 'Shoe counts' }).textContent).toContain('Streak —');
  });

  it('picks the compact layout from its measured width and honours explicit column props', () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({ width: 380, height: 0, top: 0, left: 0, right: 380, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    try {
      const { container } = render(<Scoreboard results={results} roadCols={12} />);
      expect(container.querySelector('section')?.getAttribute('data-size')).toBe('narrow');
      // roadCols=12 and 10 hands → 5 columns used → 12 visible columns drawn at 100% width
      const big = container.querySelector<SVGSVGElement>('[data-road="big"] svg');
      expect(big?.getAttribute('viewBox')).toBe(`0 0 ${12 * 20} ${6 * 20}`);
      expect(big?.style.width).toBe('100%');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
